/**
 * หน้าใบแจ้งซ่อม (ใบรับซ่อม)
 * แสดง BillContent และปุ่มพิมพ์ — แยกจากใบเสร็จรับเงินเพื่อให้ตรวจเช็ค/แก้ไขง่าย
 */
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api";
import type { RepairOrderData, ServiceType } from "@/types/repairOrder";
import {
    buildPickupIsoFromDateAndTime,
    getTodayIsoDate,
    roundTimeTo30Min,
} from "@/types/repairOrder";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ALLOWED_WARRANTY_DAYS = [30, 90, 180, 365] as const;

function formatWarrantyPeriod(warrantyDays: unknown, language: "th" | "en"): string {
  const wd = Number(warrantyDays);
  const normalized = ALLOWED_WARRANTY_DAYS.includes(wd as any) ? wd : 90;
  if (normalized === 30) return language === "th" ? "1 เดือน" : "1 month";
  if (normalized === 90) return language === "th" ? "3 เดือน" : "3 months";
  if (normalized === 180) return language === "th" ? "6 เดือน" : "6 months";
  return language === "th" ? "1 ปี" : "1 year";
}

export interface BillContentProps {
  data: RepairOrderData;
  formatPrice: (value: string) => string;
  copyLabel: string;
  language: "th" | "en";
  selectedParts?: Array<{
    id?: string;
    partNumber?: string;
    name?: string;
    nameTh?: string;
    price?: number;
  }>;
  additionalParts?: Array<{
    name: string;
    nameTh?: string;
    price: number;
  }>;
}

export const BillContent = ({ data, formatPrice, copyLabel, language, selectedParts, additionalParts }: BillContentProps) => {
  const [showLineQr, setShowLineQr] = useState(true);
  const lineQrSrc = (import.meta as any)?.env?.VITE_LINE_QR_SRC || "/line-qr.png";
  const lineQrText = (import.meta as any)?.env?.VITE_LINE_QR_TEXT || "LINE";

  return (
    <div className="repair-bill-single bg-white border-2 border-gray-800 rounded-lg p-4 print:p-3 text-gray-900">
    <div className="flex justify-between items-start mb-3 text-xs">
      <div className="text-center">
        <p className="text-base font-extrabold tracking-tight leading-none">
          MacFix <span className="font-semibold">service</span>
        </p>
        <p className="text-xs font-semibold mt-1">โทร 084-615-2244</p>
        <p className="text-[10px] mt-0.5">
          456/105 ต.ตลาดขวา อ.เมือง จ.สุราษฎร์ธานี 84000
        </p>
      </div>
      <div className="text-right space-y-1">
        <p className="text-base font-bold leading-none">ใบรับซ่อม</p>
        <div className="flex flex-col items-end gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span>วันที่</span>
            <div className="border-b border-gray-500 min-w-[90px] text-[11px] text-right">
              {data.dateOfReport || "_____/_____/______"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>เวลาแจ้งซ่อม</span>
            <div className="border-b border-gray-500 min-w-[70px] text-[11px] text-right">
              {data.timeOfReport || "______"}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-0.5">({copyLabel})</p>
      </div>
    </div>

    <div className="border-t border-gray-800 mt-3 mb-4" />

    <div className="repair-bill-fields text-xs space-y-3 mb-4">
      <div className="flex gap-4">
        <div className="flex-1 flex items-center gap-2">
          <span>ชื่อ</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.customer || ""}</span>
          </div>
        </div>
        <div className="w-48 flex items-center gap-2">
          <span>เบอร์โทร</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.phone || ""}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex items-center gap-2">
          <span>รุ่น</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.model || ""}</span>
          </div>
        </div>
        <div className="w-48 flex items-center gap-2">
          <span>สี</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.color || ""}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 flex items-center gap-2">
          <span>หมายเลขเครื่อง (IMEI)</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.serialNumber || ""}</span>
          </div>
        </div>
        <div className="w-48 flex items-center gap-2">
          <span>รหัสล็อคหน้าจอ</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px]">
            <span className="text-[11px] leading-tight px-1">{data.screenLockCode || ""}</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className="pt-1">อาการเสีย</span>
        <div className="flex-1 border-b border-gray-400 min-h-[42px]">
          <span className="text-[11px] leading-tight px-1 align-top inline-block">
            {data.problemSymptoms || ""}
          </span>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <span className="text-xs">นัดรับเครื่อง</span>
        <div className="flex-1 border-b border-gray-400 min-h-[20px] text-[11px] px-1">
          {data.scheduledPickupTime
            ? (() => {
                try {
                  const d = new Date(data.scheduledPickupTime);
                  return isNaN(d.getTime())
                    ? data.scheduledPickupTime
                    : d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
                } catch {
                  return data.scheduledPickupTime;
                }
              })()
            : "—"}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <span className="text-xs">รับประกัน</span>
        <div className="flex-1 border-b border-gray-400 min-h-[20px] text-[11px] px-1">
          {formatWarrantyPeriod((data as any).warrantyDays, language)}
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <span>ประเมินราคา</span>
        <div className="w-32 border-b border-gray-400 min-h-[20px]">
          <span className="text-[11px] leading-tight px-1">
            {data.estimatedPrice ? formatPrice(data.estimatedPrice) : ""}
          </span>
        </div>
        <span>บาท</span>
      </div>

    </div>

    <div className="mt-2 mb-3">
      <div className="bg-gray-800 text-white text-xs font-semibold px-3 py-1 inline-block rounded-t-sm">
        สรุปราคาซ่อม
      </div>
      <div className="border border-gray-800 border-t-0 rounded-b-sm p-2 text-xs">
        <div className="flex justify-between border-t border-gray-500 pt-1 mt-1 font-semibold">
          <span>รวมทั้งสิ้น (บาท)</span>
          <span>{data.repairSummaryPrice ? formatPrice(data.repairSummaryPrice) : "-"}</span>
        </div>
      </div>
    </div>

    <div className="repair-bill-conditions mt-3 border border-gray-800 rounded-sm text-[10px]">
      <div className="bg-gray-200 border-b border-gray-800 px-2 py-1 font-semibold">
        เงื่อนไขในการซ่อม
      </div>
      <div className="p-2 leading-relaxed flex gap-2">
        <div className="flex-1 space-y-1.5 min-w-0">
          <p>1. โปรดตรวจสอบรายการซ่อมให้ชัดเจนก่อนลงนามในเอกสารการซ่อม</p>
          <p>2. แจ้งผลการซ่อมภายใน 30 วัน นับจากวันที่แจ้งลูกค้า หากเกินกำหนดถือว่าสละสิทธิ์การรับประกัน</p>
          <p>3. เครื่องที่เดินทางมารับเกิน 30 วัน บริษัทขอคิดค่าฝากเครื่องตามอัตราที่กำหนด</p>
          <p>4. ความเสียหายจากการตก กระแทก เปียกน้ำ หรือการซ่อมแซมจากที่อื่น ไม่อยู่ในเงื่อนไขการรับประกัน</p>
          <p>5. การรับประกันไม่ครอบคลุมข้อมูลภายในเครื่อง ลูกค้าควรสำรองข้อมูลก่อนส่งซ่อมทุกครั้ง</p>
        </div>
        {showLineQr && (
          <div className="w-[74px] shrink-0 text-center">
            <img
              src={lineQrSrc}
              alt="LINE QR"
              className="w-[74px] h-[74px] object-contain border border-gray-300 rounded-sm bg-white"
              onError={() => setShowLineQr(false)}
            />
            <div className="mt-1 text-[9px] leading-tight text-gray-700 break-words">
              {lineQrText}
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="mt-6 flex justify-between text-[10px]">
      <div className="w-1/3 text-center">
        <div className="border-b border-gray-500 mb-1" />
        <p>ลูกค้า</p>
      </div>
      <div className="w-1/3 text-center">
        <div className="border-b border-gray-500 mb-1" />
        <p>ผู้รับซ่อม</p>
      </div>
    </div>
    </div>
  );
};

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

const RepairOrderBill = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const dataFromNav = location.state as (RepairOrderData & { returnTo?: string }) | null | undefined;
  const [reportDate, setReportDate] = useState(() => getInitialReportDateTime().dateOfReport);
  const [reportTime, setReportTime] = useState(() => getInitialReportDateTime().timeOfReport);
  const [serviceType, setServiceType] = useState<ServiceType>("walk_in");
  const [receiveTime, setReceiveTime] = useState(() => getInitialReportDateTime().timeOfReport);
  const [receiveDate, setReceiveDate] = useState(() => getTodayIsoDate());
  const [selectedParts, setSelectedParts] = useState<Array<{
    id?: string;
    partNumber?: string;
    name?: string;
    nameTh?: string;
    price?: number;
  }>>([]);
  const [additionalParts, setAdditionalParts] = useState<Array<{
    name: string;
    nameTh?: string;
    price: number;
  }>>([]);
  const [fullRepairData, setFullRepairData] = useState<any>(null);

  // Load full repair data from API if repairId is provided
  useEffect(() => {
    const state = location.state as any;
    if (!state?.repairId) return;

    const loadFullRepairData = async () => {
      try {
        // Try to get by repairNumber first, then by UUID
        let repair = null;
        try {
          const response = await apiClient.getRepairById(state.repairId);
          if (response.status === 'success' && response.data) {
            repair = response.data;
          }
        } catch (error) {
          // If getRepairById fails, try searching in all repairs
          const response = await apiClient.getRepairs(1, 1000);
          if (response.status === 'success' && response.data) {
            repair = response.data.find((r: any) => 
              r.repairNumber === state.repairId || r.id === state.repairId
            );
          }
        }

        if (repair) {
          setFullRepairData(repair);
          
          // Load parts
          if (repair.selectedParts && Array.isArray(repair.selectedParts) && repair.selectedParts.length > 0) {
            setSelectedParts(repair.selectedParts.map((part: any) => ({
              id: part.id,
              partNumber: part.partNumber || undefined,
              name: part.name,
              nameTh: part.nameTh || part.name,
              price: part.price,
            })));
          } else if (state?.selectedParts) {
            setSelectedParts(state.selectedParts);
          }
          
          if (repair.additionalParts && Array.isArray(repair.additionalParts) && repair.additionalParts.length > 0) {
            setAdditionalParts(repair.additionalParts);
          } else if (state?.additionalParts) {
            setAdditionalParts(state.additionalParts);
          }
        } else {
          // Fallback to state data
          if (state?.selectedParts) {
            setSelectedParts(state.selectedParts);
          }
          if (state?.additionalParts) {
            setAdditionalParts(state.additionalParts);
          }
        }
      } catch (error) {
        console.error('Error loading full repair data:', error);
        // Fallback to state data
        if (state?.selectedParts) {
          setSelectedParts(state.selectedParts);
        }
        if (state?.additionalParts) {
          setAdditionalParts(state.additionalParts);
        }
      }
    };

    loadFullRepairData();
  }, [location.state]);

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
    // หา element ใบแจ้งซ่อม 2 คอลัมน์ที่แสดงบนหน้าจอ
    const billEl = document.querySelector('.repair-bill-two-col');
    if (!billEl) {
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
      // ถ้า popup ถูกบล็อก ให้ fallback พิมพ์หน้าปัจจุบัน
      window.print();
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ใบแจ้งซ่อม</title>
  ${linkTags}
  ${styleTags}
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    body  { margin: 0; padding: 0; background: #fff; }
    /* บังคับให้แสดง 2 คอลัมน์ทั้งบนหน้าจอและเวลาพิมพ์ */
    .repair-bill-two-col {
      display: flex !important;
      flex-direction: row !important;
      gap: 4mm !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 2mm 0 !important;
    }
    .repair-bill-two-col > div {
      flex: 1 1 0 !important;
      max-width: 50% !important;
      min-width: 0 !important;
    }
    .repair-bill-single {
      width: 100% !important;
      height: auto !important;
      box-sizing: border-box !important;
      border-radius: 0 !important;
      font-size: 11px !important;
    }
    @media print {
      .repair-bill-two-col {
        display: flex !important;
        position: relative;
      }
      .repair-bill-two-col > div {
        flex: 0 0 calc(50% - 2mm) !important;
        max-width: calc(50% - 2mm) !important;
      }
    }
  </style>
</head>
<body>
  ${billEl.outerHTML}
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

  const formatPrice = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `฿${num.toLocaleString()}`;
  };

  // ตามตัวอย่าง: พิมพ์ 2 ใบในหน้าเดียว แยกฝั่งลูกค้า / ร้านค้า
  const leftCopyLabel = language === "th" ? "ลูกค้า" : "Customer";
  const rightCopyLabel = language === "th" ? "ร้านค้า" : "Shop";

  const effectiveData: RepairOrderData | null = (() => {
    if (!dataFromNav) return null;
    const todayIso = getTodayIsoDate();
    const todayLocale = new Date().toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Use full repair data if available, otherwise use dataFromNav
    // Extract customer name and phone from fullRepairData.customer object
    const getCustomerName = () => {
      if (fullRepairData?.customer) {
        if (typeof fullRepairData.customer === 'string') {
          return fullRepairData.customer;
        }
        if (fullRepairData.customer.fullName) {
          return fullRepairData.customer.fullName;
        }
        if (fullRepairData.customer.firstName) {
          const lastName = fullRepairData.customer.lastName || '';
          return `${fullRepairData.customer.firstName} ${lastName}`.trim();
        }
      }
      return dataFromNav.customer || '';
    };

    const getCustomerPhone = () => {
      if (fullRepairData?.customer) {
        if (typeof fullRepairData.customer === 'object' && fullRepairData.customer.phone) {
          return fullRepairData.customer.phone;
        }
      }
      return dataFromNav.phone || '';
    };

    const baseData: RepairOrderData = fullRepairData ? {
      serialNumber: fullRepairData.serialNumber || dataFromNav.serialNumber,
      customer: getCustomerName(),
      phone: getCustomerPhone(),
      model: fullRepairData.deviceModel || fullRepairData.deviceType || dataFromNav.model,
      color: fullRepairData.deviceColor || dataFromNav.color || "",
      screenLockCode: fullRepairData.screenLockCode || dataFromNav.screenLockCode || "",
      problemSymptoms: fullRepairData.problemSymptoms || fullRepairData.problemDescription || dataFromNav.problemSymptoms || "",
      deposit: fullRepairData.deposit ? String(fullRepairData.deposit) : dataFromNav.deposit || "",
      estimatedPrice: fullRepairData.estimatedPrice ? String(fullRepairData.estimatedPrice) : dataFromNav.estimatedPrice || "",
      repairSummaryPrice: fullRepairData.repairSummaryPrice ? String(fullRepairData.repairSummaryPrice) : (fullRepairData.totalCost ? String(fullRepairData.totalCost) : dataFromNav.repairSummaryPrice || ""),
      dateOfReport: fullRepairData.dateOfReport ? (() => {
        try {
          const d = new Date(fullRepairData.dateOfReport);
          return d.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        } catch {
          return dataFromNav.dateOfReport || todayLocale;
        }
      })() : dataFromNav.dateOfReport || todayLocale,
      timeOfReport: fullRepairData.timeOfReport || dataFromNav.timeOfReport,
      scheduledPickupTime: fullRepairData.scheduledPickupTime ? (() => {
        try {
          return new Date(fullRepairData.scheduledPickupTime).toISOString();
        } catch {
          return dataFromNav.scheduledPickupTime;
        }
      })() : dataFromNav.scheduledPickupTime,
      service_type: (fullRepairData.serviceType || dataFromNav.service_type || "walk_in") as ServiceType,
      receive_date: fullRepairData.receiveDate ? (() => {
        try {
          const d = new Date(fullRepairData.receiveDate);
          return d.toISOString().split('T')[0];
        } catch {
          return dataFromNav.receive_date || todayIso;
        }
      })() : dataFromNav.receive_date || todayIso,
      receive_time: fullRepairData.receiveTime || dataFromNav.receive_time,
      warrantyDays: Number(fullRepairData.warrantyDays ?? (dataFromNav as any).warrantyDays ?? 90),
      selectedPartId: dataFromNav.selectedPartId,
      selectedParts: dataFromNav.selectedParts,
      additionalParts: dataFromNav.additionalParts,
    } : dataFromNav;

    if (serviceType === "walk_in") {
      const pickupIso = buildPickupIsoFromDateAndTime(todayIso, receiveTime);
      return {
        ...baseData,
        service_type: "walk_in",
        receive_date: todayIso,
        receive_time: receiveTime,
        dateOfReport: baseData.dateOfReport || todayLocale,
        timeOfReport: baseData.timeOfReport ?? receiveTime,
        scheduledPickupTime: pickupIso ?? baseData.scheduledPickupTime,
      };
    }
    const pickupIso = buildPickupIsoFromDateAndTime(receiveDate, receiveTime);
    return {
      ...baseData,
      service_type: "drop_off",
      receive_date: receiveDate,
      receive_time: receiveTime,
      dateOfReport: reportDate || baseData.dateOfReport,
      timeOfReport: reportTime || baseData.timeOfReport,
      scheduledPickupTime: pickupIso ?? baseData.scheduledPickupTime,
    };
  })();

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
              {language === "th" ? "กลับไปรายการ" : "Back to list"}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto repair-bill-page">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
          <Button variant="outline" onClick={() => {
            // กลับไปหน้าที่ระบุไว้ใน returnTo หรือกลับไปที่จัดการใบแจ้งซ่อม
            const returnPath = dataFromNav?.returnTo || "/repairs/bill/management";
            navigate(returnPath);
          }} className="gap-2 w-fit">
            <ArrowLeft className="w-4 h-4" />
            {language === "th" ? "กลับรายการ" : "Back to list"}
          </Button>
          <Button onClick={handlePrint} className="gap-2 w-fit">
            <Printer className="w-4 h-4" />
            {t("printBill")}
          </Button>
        </div>

        {/* แสดง 2 ใบคู่กัน (ซ้าย: ลูกค้า, ขวา: ร้านค้า) ให้เหมือนตัวอย่าง */}
        <div className="repair-bill-two-col print:hidden flex flex-row gap-4 w-full max-w-[290mm] mx-auto">
          {effectiveData && (
            <>
              <div className="flex-1">
                <BillContent
                  data={effectiveData}
                  formatPrice={formatPrice}
                  copyLabel={leftCopyLabel}
                  language={language}
                  selectedParts={selectedParts}
                  additionalParts={additionalParts}
                />
              </div>
              <div className="flex-1">
                <BillContent
                  data={effectiveData}
                  formatPrice={formatPrice}
                  copyLabel={rightCopyLabel}
                  language={language}
                  selectedParts={selectedParts}
                  additionalParts={additionalParts}
                />
              </div>
            </>
          )}
        </div>

        <div className="repair-bill-two-col hidden print:flex flex-row gap-4 w-full max-w-[290mm] mx-auto">
          {effectiveData && (
            <>
              <div className="flex-1">
                <BillContent
                  data={effectiveData}
                  formatPrice={formatPrice}
                  copyLabel={leftCopyLabel}
                  language={language}
                  selectedParts={selectedParts}
                  additionalParts={additionalParts}
                />
              </div>
              <div className="flex-1">
                <BillContent
                  data={effectiveData}
                  formatPrice={formatPrice}
                  copyLabel={rightCopyLabel}
                  language={language}
                  selectedParts={selectedParts}
                  additionalParts={additionalParts}
                />
              </div>
            </>
          )}
        </div>
        <p className="print:hidden text-center text-sm text-muted-foreground mt-4">
          {language === "th"
            ? "เมื่อพิมพ์จะได้ 2 ใบรับซ่อม (ลูกค้า/ร้านค้า) ต่อ 1 หน้า A4"
            : "Print: 2 repair orders (customer/shop) per A4 page"}
        </p>
      </div>
    </MainLayout>
  );
};

export default RepairOrderBill;
