/**
 * หน้าใบเสร็จรับเงิน (Receipt)
 * แสดง ReceiptContent และปุ่มพิมพ์ — แยกจากใบแจ้งซ่อมเพื่อให้ตรวจเช็ค/แก้ไขง่าย
 */
import { MainLayout } from "@/components/layout/MainLayout";
import { ReceiptContent } from "@/components/receipt/ReceiptContent";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs } from "@/contexts/RepairsContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import type { ReceiptData } from "@/lib/receipt";
import { mapRepairOrderToReceiptData } from "@/lib/receipt";
import type { RepairOrderData, ServiceType } from "@/types/repairOrder";
import {
    buildPickupIsoFromDateAndTime,
    getTodayIsoDate,
    roundTimeTo30Min,
} from "@/types/repairOrder";
import { ArrowLeft, Download, Printer, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function getDefaultReportDateTime(language: "th" | "en") {
  const now = new Date();
  return {
    dateOfReport: now.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    timeOfReport: roundTimeTo30Min(
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    ),
  };
}

function getInitialReportDateTime() {
  const now = new Date();
  const raw = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return {
    dateOfReport: now.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    timeOfReport: roundTimeTo30Min(raw),
  };
}

const RepairReceipt = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { refreshRepairs } = useRepairs();
  const receiptRef = useRef<HTMLDivElement>(null);
  const dataFromNav = location.state as (RepairOrderData & { repairId?: string; returnTo?: string }) | null | undefined;
  const [reportDate, setReportDate] = useState(() => getInitialReportDateTime().dateOfReport);
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportTime, setReportTime] = useState(() => getInitialReportDateTime().timeOfReport);
  const [serviceType, setServiceType] = useState<ServiceType>("walk_in");
  const [receiveTime, setReceiveTime] = useState(() => getInitialReportDateTime().timeOfReport);
  const [receiveDate, setReceiveDate] = useState(() => getTodayIsoDate());
  const [selectedPart, setSelectedPart] = useState<{ partNumber?: string; name?: string; nameTh?: string; price?: number } | null>(null);
  const [selectedParts, setSelectedParts] = useState<Array<{ partNumber?: string; name?: string; nameTh?: string; price?: number }>>([]);
  const [additionalParts, setAdditionalParts] = useState<Array<{ name: string; nameTh?: string; price: number }>>([]);
  const [isSendingToLine, setIsSendingToLine] = useState(false);
  /** ข้อมูลใบเสร็จที่แก้ไขได้ — sync จาก receiptData เมื่อโหลด/เปลี่ยนงานซ่อม */
  const [editableReceipt, setEditableReceipt] = useState<ReceiptData | null>(null);

  // Load repair data from API if repairId is provided
  useEffect(() => {
    const loadRepairData = async () => {
      // ถ้าไม่มี repairId แต่มี selectedPartId ใน dataFromNav ให้ดึง part จาก API
      if (!dataFromNav?.repairId && dataFromNav?.selectedPartId) {
        try {
          const partResponse = await apiClient.getPartById(dataFromNav.selectedPartId);
          if (partResponse.status === 'success' && partResponse.data) {
            const part = partResponse.data;
            setSelectedPart({
              partNumber: part.partNumber || undefined,
              name: part.name,
              nameTh: part.nameTh || part.name,
              price: part.price,
            });
          }
        } catch (error) {
          console.error('Error loading part data:', error);
        }
        return;
      }
      
      if (!dataFromNav?.repairId) {
        // ถ้าไม่มี repairId แต่มีข้อมูลอะไหล่ใน dataFromNav ให้ใช้ข้อมูลนั้น
        if (dataFromNav && 'selectedParts' in dataFromNav && dataFromNav.selectedParts) {
          setSelectedParts(dataFromNav.selectedParts as any);
        }
        if (dataFromNav && 'additionalParts' in dataFromNav && dataFromNav.additionalParts != null) {
          const raw = dataFromNav.additionalParts;
          const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
          setAdditionalParts(Array.isArray(arr) ? arr : []);
        }
        if (dataFromNav && 'selectedPart' in dataFromNav && dataFromNav.selectedPart) {
          setSelectedPart(dataFromNav.selectedPart as any);
        }
        return;
      }
      
      // ถ้ามี repairId ให้โหลดข้อมูลอะไหล่จาก API เสมอเพื่อให้ได้ข้อมูลล่าสุด
      try {
        // ดึงข้อมูล repairs ทั้งหมดและหา repair ที่ตรงกับ repairId (อาจเป็น repairNumber หรือ UUID)
        const response = await apiClient.getRepairs();
        if (response.status === 'success' && response.data) {
          // หา repair จาก repairNumber หรือ id
          const repair = response.data.find((r: any) => 
            r.repairNumber === dataFromNav.repairId || r.id === dataFromNav.repairId
          );
          if (repair) {
            // ถ้ามี selectedParts (array) ให้ใช้
            if (repair.selectedParts && Array.isArray(repair.selectedParts) && repair.selectedParts.length > 0) {
              setSelectedParts(repair.selectedParts.map((part: any) => ({
                partNumber: part.partNumber || undefined,
                name: part.name,
                nameTh: part.nameTh || part.name,
                price: part.price,
              })));
            } else if (repair.selectedPart) {
              // backward compatibility: ถ้ามี selectedPart เดียว
              setSelectedPart({
                partNumber: repair.selectedPart.partNumber || undefined,
                name: repair.selectedPart.name,
                nameTh: repair.selectedPart.nameTh || repair.selectedPart.name,
                price: repair.selectedPart.price,
              });
            } else {
              // ถ้าไม่มี selectedParts ใน API แต่มีใน dataFromNav ให้ใช้ข้อมูลจาก dataFromNav
              if (dataFromNav && 'selectedParts' in dataFromNav && dataFromNav.selectedParts) {
                setSelectedParts(dataFromNav.selectedParts as any);
              } else if (dataFromNav && 'selectedPart' in dataFromNav && dataFromNav.selectedPart) {
                setSelectedPart(dataFromNav.selectedPart as any);
              }
            }

            // โหลด additionalParts (ถ้ามี) — รองรับทั้ง array และ JSON string จาก API
            if (repair.additionalParts != null) {
              const raw = repair.additionalParts;
              const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
              if (Array.isArray(arr) && arr.length > 0) {
                setAdditionalParts(arr);
              } else if (dataFromNav && 'additionalParts' in dataFromNav && dataFromNav.additionalParts != null) {
                // ถ้าไม่มีใน API แต่มีใน dataFromNav ให้ใช้ข้อมูลจาก dataFromNav
                const raw = dataFromNav.additionalParts;
                const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
                setAdditionalParts(Array.isArray(arr) ? arr : []);
              }
            } else if (dataFromNav && 'additionalParts' in dataFromNav && dataFromNav.additionalParts != null) {
              // ถ้าไม่มีใน API แต่มีใน dataFromNav ให้ใช้ข้อมูลจาก dataFromNav
              const raw = dataFromNav.additionalParts;
              const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
              setAdditionalParts(Array.isArray(arr) ? arr : []);
            }
          } else {
            // ถ้าไม่พบ repair ใน API แต่มีข้อมูลใน dataFromNav ให้ใช้ข้อมูลจาก dataFromNav
            if (dataFromNav && 'selectedParts' in dataFromNav && dataFromNav.selectedParts) {
              setSelectedParts(dataFromNav.selectedParts as any);
            } else if (dataFromNav && 'selectedPart' in dataFromNav && dataFromNav.selectedPart) {
              setSelectedPart(dataFromNav.selectedPart as any);
            }
            if (dataFromNav && 'additionalParts' in dataFromNav && dataFromNav.additionalParts != null) {
              const raw = dataFromNav.additionalParts;
              const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
              setAdditionalParts(Array.isArray(arr) ? arr : []);
            }
          }
        }
      } catch (error) {
        console.error('Error loading repair data:', error);
        // ถ้าโหลดจาก API ไม่ได้ แต่มีข้อมูลใน dataFromNav ให้ใช้ข้อมูลจาก dataFromNav
        if (dataFromNav && 'selectedParts' in dataFromNav && dataFromNav.selectedParts) {
          setSelectedParts(dataFromNav.selectedParts as any);
        } else if (dataFromNav && 'selectedPart' in dataFromNav && dataFromNav.selectedPart) {
          setSelectedPart(dataFromNav.selectedPart as any);
        }
        if (dataFromNav && 'additionalParts' in dataFromNav && dataFromNav.additionalParts != null) {
          const raw = dataFromNav.additionalParts;
          const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
          setAdditionalParts(Array.isArray(arr) ? arr : []);
        }
      }
    };

    loadRepairData();
  }, [dataFromNav?.repairId, dataFromNav?.selectedPartId]);

  useEffect(() => {
    if (!dataFromNav) return;
    const defaultDt = getDefaultReportDateTime(language);
    let dateVal = dataFromNav.dateOfReport || defaultDt.dateOfReport;
    let timeVal = dataFromNav.timeOfReport ?? defaultDt.timeOfReport;
    if (dateVal.includes("T")) {
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          dateVal = d.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          if (!dataFromNav.timeOfReport)
            timeVal = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        }
      } catch {
        //
      }
    }
    setReportDate(dateVal);
    setReportTime(timeVal);
    const st = dataFromNav.service_type ?? "walk_in";
    setServiceType(st);
    if (dataFromNav.receive_time) setReceiveTime(roundTimeTo30Min(dataFromNav.receive_time));
    else if (st === "walk_in") setReceiveTime(roundTimeTo30Min(timeVal));
    if (st === "drop_off" && dataFromNav.receive_date) {
      const rd = dataFromNav.receive_date;
      if (rd.includes("-") && rd.length >= 10) setReceiveDate(rd.slice(0, 10));
      else if (rd.includes("/")) {
        const p = rd.trim().split(/[/-]/).map((s) => parseInt(s, 10));
        if (p.length >= 3) {
          let y = p[2];
          if (y > 2500) y -= 543;
          setReceiveDate(`${y}-${p[1].toString().padStart(2, "0")}-${p[0].toString().padStart(2, "0")}`);
        }
      }
    } else if (st === "drop_off") setReceiveDate(getTodayIsoDate());
  }, [
    dataFromNav?.dateOfReport,
    dataFromNav?.timeOfReport,
    dataFromNav?.service_type,
    dataFromNav?.receive_date,
    dataFromNav?.receive_time,
    language,
    !!dataFromNav,
  ]);

  const handlePrint = () => {
    // หา element ใบเสร็จในหน้า
    const receiptEl = document.querySelector('.receipt-document');
    if (!receiptEl) {
      window.print();
      return;
    }

    // รวบรวม <link rel="stylesheet"> ทั้งหมดจาก head
    const linkTags = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    )
      .map((link) => link.outerHTML)
      .join('\n');

    // รวบรวม <style> ทั้งหมดจาก head
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map((style) => style.outerHTML)
      .join('\n');

    // เปิดหน้าต่างใหม่
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // ถ้า popup ถูกบล็อก ให้ fallback เป็นพิมพ์หน้าปัจจุบัน
      window.print();
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบเสร็จรับเงิน</title>
  ${linkTags}
  ${styleTags}
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body  { margin: 0; padding: 0; background: #fff; }
    .receipt-document {
      max-width: none !important;
      width: 100%;
      box-shadow: none !important;
      padding: 0 !important;
    }
    .receipt-editable { outline: none !important; box-shadow: none !important; }
  </style>
</head>
<body>
  ${receiptEl.outerHTML}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
        window.onafterprint = function () { window.close(); };
      }, 600);
    });
  </script>
</body>
</html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = async () => {
    const receiptEl = receiptRef.current?.querySelector('.receipt-document') as HTMLElement | null
      || document.querySelector('.receipt-document') as HTMLElement | null;

    if (!receiptEl) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "ไม่พบข้อมูลใบเสร็จ" : "Receipt element not found",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      // Capture element as canvas (scale 2 = retina quality)
      const canvas = await html2canvas(receiptEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();   // 210 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // ถ้าภาพสูงเกิน 1 หน้า ให้แบ่งหลายหน้า
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let yOffset = 0;
        let remainingHeight = imgHeight;
        let page = 0;
        while (remainingHeight > 0) {
          if (page > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -yOffset, imgWidth, imgHeight);
          yOffset += pdfHeight;
          remainingHeight -= pdfHeight;
          page++;
        }
      }

      const receiptNo = dataFromNav?.repairId || "receipt";
      pdf.save(`ใบเสร็จ-${receiptNo}.pdf`);

      toast({
        title: language === "th" ? "ดาวน์โหลดสำเร็จ" : "Downloaded",
        description: language === "th" ? "บันทึกไฟล์ PDF เรียบร้อยแล้ว" : "PDF file saved successfully",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "ไม่สามารถสร้างไฟล์ PDF ได้" : "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // ส่งรูปภาพใบเสร็จไปยัง LINE ของลูกค้า
  const handleSendToLine = async () => {
    const receiptEl =
      receiptRef.current?.querySelector(".receipt-document") as HTMLElement | null
      || document.querySelector(".receipt-document") as HTMLElement | null;

    if (!receiptEl) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "ไม่พบข้อมูลใบเสร็จ" : "Receipt element not found",
        variant: "destructive",
      });
      return;
    }

    if (!dataFromNav?.repairId) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "ไม่พบข้อมูลงานซ่อม" : "Repair data not found",
        variant: "destructive",
      });
      return;
    }

    setIsSendingToLine(true);
    try {
      // ค้นหา customerId จาก repair
      const repairsRes = await apiClient.getRepairs();
      const repair =
        repairsRes.status === "success" &&
        repairsRes.data?.find(
          (r: any) =>
            r.repairNumber === dataFromNav.repairId ||
            r.id === dataFromNav.repairId
        );

      if (!repair) {
        throw new Error(language === "th" ? "ไม่พบข้อมูลงานซ่อม" : "Repair not found");
      }

      const customerId: string = repair.customerId || repair.customer?.id;
      if (!customerId) {
        throw new Error(language === "th" ? "ไม่พบข้อมูลลูกค้า" : "Customer not found");
      }

      // Capture ใบเสร็จเป็น PNG blob
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create image blob"))),
          "image/jpeg",
          0.92
        )
      );

      const receiptNo = dataFromNav.repairId || `receipt-${Date.now()}`;
      const result = await apiClient.sendReceiptImageViaLine(customerId, blob, receiptNo);

      toast({
        title: language === "th" ? "ส่งสำเร็จ ✅" : "Sent Successfully ✅",
        description:
          language === "th"
            ? `ส่งรูปใบเสร็จไปยัง LINE ของ ${result.data?.customerName || "ลูกค้า"} เรียบร้อยแล้ว`
            : `Receipt image sent to ${result.data?.customerName || "customer"}'s LINE`,
      });
    } catch (error) {
      console.error("[Send to LINE] Error:", error);
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description:
          error instanceof Error
            ? error.message
            : language === "th"
            ? "ไม่สามารถส่งรูปใบเสร็จไปยัง LINE ได้"
            : "Failed to send receipt image to LINE",
        variant: "destructive",
      });
    } finally {
      setIsSendingToLine(false);
    }
  };


  const effectiveData: RepairOrderData | null = (() => {
    if (!dataFromNav) return null;
    const todayIso = getTodayIsoDate();
    const todayLocale = new Date().toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (serviceType === "walk_in") {
      const pickupIso = buildPickupIsoFromDateAndTime(todayIso, receiveTime);
      return {
        ...dataFromNav,
        service_type: "walk_in",
        receive_date: todayIso,
        receive_time: receiveTime,
        dateOfReport: dataFromNav.dateOfReport || todayLocale,
        timeOfReport: dataFromNav.timeOfReport ?? receiveTime,
        scheduledPickupTime: pickupIso ?? dataFromNav.scheduledPickupTime,
      };
    }
    const pickupIso = buildPickupIsoFromDateAndTime(receiveDate, receiveTime);
    return {
      ...dataFromNav,
      service_type: "drop_off",
      receive_date: receiveDate,
      receive_time: receiveTime,
      dateOfReport: reportDate || dataFromNav.dateOfReport,
      timeOfReport: reportTime || dataFromNav.timeOfReport,
      scheduledPickupTime: pickupIso ?? dataFromNav.scheduledPickupTime,
    };
  })();

  const additionalPartsSafe = Array.isArray(additionalParts) ? additionalParts : [];
  const receiptData = effectiveData
    ? mapRepairOrderToReceiptData(effectiveData, {
        receiptNo: (dataFromNav as { repairId?: string })?.repairId ?? "—",
        issueDate: effectiveData.dateOfReport,
        copyLabel: t("receiptForCustomer"),
        selectedPart: selectedPart, // backward compatibility
        selectedParts: selectedParts.length > 0 ? selectedParts : undefined,
        additionalParts: additionalPartsSafe.length > 0 ? additionalPartsSafe : undefined,
      })
    : null;

  // Sync ข้อมูลที่แก้ไขได้จาก receiptData เมื่อเปิดใบเสร็จหรือเปลี่ยนงานซ่อมหรือข้อมูลอะไหล่เปลี่ยน
  useEffect(() => {
    if (receiptData && dataFromNav?.repairId) {
      setEditableReceipt((prev) => {
        // อัพเดทเมื่อ receiptNo เปลี่ยน หรือเมื่อ items เปลี่ยน (อะไหล่เปลี่ยน)
        const receiptDataItemsStr = JSON.stringify(receiptData.items);
        const prevItemsStr = prev ? JSON.stringify(prev.items) : '';
        if (!prev || prev.receiptNo !== receiptData.receiptNo || receiptDataItemsStr !== prevItemsStr) {
          return JSON.parse(JSON.stringify(receiptData));
        }
        return prev;
      });
    } else if (!receiptData) {
      setEditableReceipt(null);
    }
  }, [dataFromNav?.repairId, receiptData]);

  const displayReceiptData = editableReceipt ?? receiptData;

  const handleReceiptChange = (updates: Partial<ReceiptData>) => {
    setEditableReceipt((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (updates.items) {
        const subtotal = updates.items.reduce((sum, i) => sum + i.amount, 0);
        next.subtotal = subtotal;
        next.grandTotal = subtotal;
      }
      return next;
    });
  };

  if (!dataFromNav) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-muted-foreground text-center py-8">
            {language === "th" ? "กรุณาเลือกงานซ่อมจากรายการออกบิล" : "Please select a repair from the bill list."}
          </p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => {
              // กลับไปหน้าที่ระบุไว้ใน returnTo หรือกลับไปที่จัดการใบแจ้งซ่อม
              const returnPath = dataFromNav?.returnTo || "/repairs/bill/management";
              navigate(returnPath);
            }} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {language === "th" ? "กลับไปรายการออกบิล" : "Back to bill list"}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto repair-receipt-page">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
          <Button variant="outline" onClick={() => navigate("/repairs/bill/management")} className="gap-2 w-fit">
            <ArrowLeft className="w-4 h-4" />
            {language === "th" ? "กลับรายการ" : "Back to list"}
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="gap-2 w-fit"
              disabled={isDownloading}
            >
              <Download className="w-4 h-4" />
              {isDownloading
                ? (language === "th" ? "กำลังสร้าง PDF..." : "Generating PDF...")
                : (language === "th" ? "ดาวน์โหลด PDF" : "Download PDF")}
            </Button>
            <Button
              onClick={handleSendToLine}
              variant="outline"
              className="gap-2 w-fit border-[#06C755] text-[#06C755] hover:bg-[#06C755] hover:text-white"
              disabled={isSendingToLine}
            >
              <Share2 className="w-4 h-4" />
              {isSendingToLine
                ? (language === "th" ? "กำลังส่ง LINE..." : "Sending to LINE...")
                : (language === "th" ? "ส่งรูปใบเสร็จไป LINE" : "Send Receipt to LINE")}
            </Button>
            <Button onClick={handlePrint} className="gap-2 w-fit">
              <Printer className="w-4 h-4" />
              {t("printBill")}
            </Button>
          </div>
        </div>

        <div className="receipt-print-wrapper hidden print:block">
          {displayReceiptData && <ReceiptContent data={displayReceiptData} />}
        </div>

        <div ref={receiptRef} className="print:hidden flex flex-col w-full max-w-[210mm] mx-auto">
          {displayReceiptData && (
            <ReceiptContent
              data={displayReceiptData}
              editable
              onChange={handleReceiptChange}
            />
          )}
        </div>
        <p className="print:hidden text-center text-sm text-muted-foreground mt-4">
          {language === "th"
            ? "เมื่อพิมพ์จะได้ 1 ใบเสร็จต่อ 1 หน้า A4"
            : "Print: 1 receipt per A4 page"}
        </p>
      </div>
    </MainLayout>
  );
};

export default RepairReceipt;
