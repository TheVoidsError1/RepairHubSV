import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs, type RepairItem } from "@/contexts/RepairsContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { getRepairStatusLabel } from "@/lib/repairStatus";
import { type RepairOrderData } from "@/types/repairOrder";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const statusStyles: Record<string, string> = {
  pending: "status-pending",
  "in-progress": "status-in-progress",
  completed: "status-completed",
  cancelled: "status-cancelled",
  "picked-up": "status-completed",
};

const RepairBillPreview = ({
  data,
  copyLabel,
  onChange,
}: {
  data: RepairOrderData;
  copyLabel: string;
  onChange: (patch: Partial<RepairOrderData>) => void;
}) => {
  const formatPrice = (value: string) => {
    const num = parseFloat(value);
    return Number.isNaN(num) ? "-" : `฿${num.toLocaleString()}`;
  };
  const [showLineQr, setShowLineQr] = useState(true);
  const lineQrSrc = (import.meta as any)?.env?.VITE_LINE_QR_SRC || "/line-qr.png";
  const lineQrText = (import.meta as any)?.env?.VITE_LINE_QR_TEXT || "LINE";

  return (
    <div className="repair-bill-single bg-white border-2 border-gray-800 rounded-lg p-4 text-gray-900">
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

      <div className="text-xs space-y-3 mb-4">
        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-2">
            <span>ชื่อ</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]">
              <input
                className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
                value={data.customer}
                onChange={(e) => onChange({ customer: e.target.value })}
              />
            </div>
          </div>
          <div className="w-48 flex items-center gap-2">
            <span>เบอร์โทร</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]">
              <input
                className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
                value={data.phone}
                onChange={(e) => onChange({ phone: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-2">
            <span>รุ่น</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]">
              <input
                className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
                value={data.model}
                onChange={(e) => onChange({ model: e.target.value })}
              />
            </div>
          </div>
          <div className="w-48 flex items-center gap-2">
            <span>สี</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]">
              <input
                className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
                value={data.color}
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-2">
            <span>หมายเลขเครื่อง (IMEI)</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]" />
          </div>
          <div className="w-48 flex items-center gap-2">
            <span>รหัสล็อคหน้าจอ</span>
            <div className="flex-1 border-b border-gray-400 min-h-[20px]">
              <input
                className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
                value={data.screenLockCode}
                onChange={(e) => onChange({ screenLockCode: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <span className="pt-1">อาการเสีย</span>
          <div className="flex-1 border-b border-gray-400 min-h-[42px]">
            <textarea
              className="w-full text-[11px] leading-tight px-1 align-top inline-block bg-transparent outline-none resize-none"
              value={data.problemSymptoms}
              onChange={(e) =>
                onChange({ problemSymptoms: e.target.value })
              }
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <span className="text-xs">นัดรับเครื่อง</span>
          <div className="flex-1 border-b border-gray-400 min-h-[20px] text-[11px] px-1">
            {data.scheduledPickupTime
              ? (() => {
                  try {
                    const d = new Date(data.scheduledPickupTime);
                    return Number.isNaN(d.getTime())
                      ? data.scheduledPickupTime
                      : d.toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        });
                  } catch {
                    return data.scheduledPickupTime;
                  }
                })()
              : "—"}
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <span>ประเมินราคา</span>
          <div className="w-32 border-b border-gray-400 min-h-[20px]">
            <input
              className="w-full text-[11px] leading-tight px-1 bg-transparent outline-none"
              value={data.estimatedPrice}
              onChange={(e) =>
                onChange({
                  estimatedPrice: e.target.value,
                  repairSummaryPrice: e.target.value,
                })
              }
            />
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
            <span>
              {data.repairSummaryPrice
                ? formatPrice(data.repairSummaryPrice)
                : "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 border border-gray-800 rounded-sm text-[10px]">
        <div className="bg-gray-200 border-b border-gray-800 px-2 py-1 font-semibold">
          เงื่อนไขในการซ่อม
        </div>
        <div className="p-2 leading-relaxed flex gap-2">
          <div className="flex-1 space-y-1.5 min-w-0">
            <p>1. โปรดตรวจสอบรายการซ่อมให้ชัดเจนก่อนลงนามในเอกสารการซ่อม</p>
            <p>
              2. แจ้งผลการซ่อมภายใน 30 วัน นับจากวันที่แจ้งลูกค้า หากเกินกำหนดถือว่าสละสิทธิ์การรับประกัน
            </p>
            <p>
              3. เครื่องที่เดินทางมารับเกิน 30 วัน บริษัทขอคิดค่าฝากเครื่องตามอัตราที่กำหนด
            </p>
            <p>
              4. ความเสียหายจากการตก กระแทก เปียกน้ำ หรือการซ่อมแซมจากที่อื่น ไม่อยู่ในเงื่อนไขการรับประกัน
            </p>
            <p>
              5. การรับประกันไม่ครอบคลุมข้อมูลภายในเครื่อง ลูกค้าควรสำรองข้อมูลก่อนส่งซ่อมทุกครั้ง
            </p>
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

      <div className="mt-4 flex justify-between text-[10px]">
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

const Repairs = () => {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { repairs, setRepairs, refreshRepairs, isLoading, pagination, setPagination } = useRepairs();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<"all" | "endOfDay" | "leaveDevice">("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [editingStatus, setEditingStatus] = useState<
    "pending" | "in-progress" | "completed" | "cancelled" | "picked-up"
  >("pending");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  // เปลี่ยนสถานะจากตารางโดยตรง (ไม่ผ่าน Edit dialog)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    repair: RepairItem;
    newStatus: "pending" | "in-progress" | "completed" | "cancelled" | "picked-up";
  } | null>(null);
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false);
  const { toast } = useToast();

  // เดิมเปิด Dialog — ตอนนี้ไปหน้าสร้างงานซ่อมเต็มหน้าแทน
  useEffect(() => {
    if (searchParams.get("openCreate") === "1") {
      navigate("/repairs/new", { replace: true });
    }
  }, [searchParams, navigate]);

  // ซิงค์ฟิลเตอร์สถานะจาก URL (?status=...) เมื่อมาจาก Sidebar — ถ้าไม่มี query หรือไม่ตรงค่าที่รองรับ ให้แสดงทั้งหมด (หน้าสถานะงานซ่อม)
  useEffect(() => {
    const status = searchParams.get("status");
    if (status && ["all", "pending", "in-progress", "completed", "cancelled", "picked-up"].includes(status)) {
      setStatusFilter(status);
    } else {
      setStatusFilter("all");
    }
  }, [searchParams.get("status")]);

  const statusLabels: Record<string, string> = {
    pending: t("pending"),
    "in-progress": t("inProgress"),
    completed: t("completed"),
    cancelled: t("cancelled"),
    "picked-up": t("pickedUp"),
  };

  // Filter repairs for display (client-side filtering for search/filter)
  // Note: For better performance with large datasets, filtering should be done on the backend
  const filteredRepairs = repairs.filter((repair) => {
    const matchesSearch =
      repair.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repair.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repair.device.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || repair.status === statusFilter;
    const matchesTag =
      tagFilter === "all" || repair.tag === tagFilter;
    return matchesSearch && matchesStatus && matchesTag;
  });

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      refreshRepairs(newPage, pagination.limit);
    }
  };

  const handleEditOrder = (repair: RepairItem) => {
    setEditingRepair(repair);
    setEditingStatus(
      (repair.status as
        | "pending"
        | "in-progress"
        | "completed"
        | "cancelled"
        | "picked-up") ?? "pending"
    );
    setCancelReason("");
    setEditOpen(true);
  };

  // เปลี่ยนสถานะจาก dropdown ในตาราง
  const handleQuickStatusChange = (
    repair: RepairItem,
    newStatus: "pending" | "in-progress" | "completed" | "cancelled" | "picked-up"
  ) => {
    if (repair.status === newStatus) return;
    setPendingStatusChange({ repair, newStatus });
    setCancelReason("");
    if (newStatus === "cancelled") {
      setCancelReasonOpen(true);
    } else {
      setConfirmSaveOpen(true);
    }
  };

  const applyStatusUpdate = async () => {
    // ตรวจสอบว่ามีผู้ใช้ล็อกอินอยู่
    if (!currentUser) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "กรุณาเข้าสู่ระบบก่อน" : "Please login first",
        variant: "destructive",
      });
      setConfirmSaveOpen(false);
      return;
    }

    // ตรวจสอบรหัสผ่าน
    if (!confirmPassword) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" ? "กรุณากรอกรหัสผ่าน" : "Please enter password",
        variant: "destructive",
      });
      return;
    }

    // ดึงข้อมูลผู้ใช้จาก localStorage เพื่อหา email
    const storedUser = localStorage.getItem('user');
    let userEmail = '';
    
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        userEmail = userData.email || currentUser.username;
      } catch {
        userEmail = currentUser.username;
      }
    } else {
      userEmail = currentUser.username;
    }

    // ตรวจสอบรหัสผ่านผ่าน API
    try {
      const loginResponse = await apiClient.login(userEmail, confirmPassword);
      
      if (loginResponse.status !== 'success') {
        toast({
          title: language === "th" ? "รหัสผ่านไม่ถูกต้อง" : "Invalid password",
          description: language === "th" 
            ? "รหัสผ่านที่กรอกไม่ถูกต้อง" 
            : "The password you entered is incorrect",
          variant: "destructive",
        });
        setConfirmPassword("");
        return;
      }
    } catch (error) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" 
          ? "ไม่สามารถตรวจสอบรหัสผ่านได้" 
          : "Unable to verify password",
        variant: "destructive",
      });
      setConfirmPassword("");
      return;
    }

    // อัปเดตสถานะลง database
    const repairToUpdate = editingRepair || pendingStatusChange?.repair;
    const newStatus = editingRepair ? editingStatus : pendingStatusChange?.newStatus;
    
    if (repairToUpdate && newStatus) {
      try {
        // เรียก API เพื่ออัปเดตสถานะลง database
        const updateResponse = await apiClient.updateRepair(repairToUpdate.id, {
          status: newStatus,
        });

        if (updateResponse.status === 'success') {
          // อัปเดตสถานะใน state ชั่วคราว
          setRepairs((prev) =>
            prev.map((r) =>
              r.id === repairToUpdate.id ? { ...r, status: newStatus } : r
            )
          );
          
          // Refresh ข้อมูลจาก database
          await refreshRepairs();
          
          toast({
            title: language === "th" ? "อัปเดตสำเร็จ" : "Update successful",
            description: t("statusUpdateSuccess"),
          });
        } else {
          const errorMsg = updateResponse.message || updateResponse.error || 'Failed to update status';
          console.error('Update repair API error:', updateResponse);
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('Error updating repair status:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : (language === "th" 
            ? "ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่อีกครั้ง" 
            : "Failed to update status. Please try again.");
        toast({
          title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }
    }
    
    setConfirmSaveOpen(false);
    setEditOpen(false);
    setEditingRepair(null);
    setPendingStatusChange(null);
    setCancelReason("");
    setConfirmPassword("");
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    setSearchParams(next);
  };

  const handleTagFilterChange = (value: "all" | "endOfDay" | "leaveDevice") => {
    setTagFilter(value);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("repairManagement")}</h1>
          <p className="page-description">{t("repairDescription")}</p>
        </div>
      </div>

      {/* ค้นหา + dropdown กรองสถานะ (มีสีตามสถานะ) - Responsive */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchByIdCustomerDevice")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger
              className={`w-full sm:w-[200px] ${
                statusFilter === "all"
                  ? ""
                  : `status-badge border-0 ${statusStyles[statusFilter]}`
              }`}
            >
              <Filter className="w-4 h-4 mr-2 shrink-0" />
              <SelectValue placeholder={t("filterByStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  {t("allStatus")}
                </span>
              </SelectItem>
              <SelectItem value="in-progress">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-in-progress))]" />
                  {t("inProgress")}
                </span>
              </SelectItem>
              <SelectItem value="completed">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-completed))]" />
                  {t("completed")}
                </span>
              </SelectItem>
              <SelectItem value="picked-up">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-completed))]" />
                  {t("pickedUp")}
                </span>
              </SelectItem>
              <SelectItem value="cancelled">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-cancelled))]" />
                  {t("cancelled")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={handleTagFilterChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t("tagLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === "th" ? "ทุกแท็ก" : "All tags"}
              </SelectItem>
              <SelectItem value="endOfDay">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t("addQuickData")}
                </span>
              </SelectItem>
              <SelectItem value="leaveDevice">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {t("addRepairData")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Repairs Table - Desktop & Mobile Card View */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{language === "th" ? "กำลังโหลดข้อมูล..." : "Loading..."}</p>
          </div>
        ) : filteredRepairs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{language === "th" ? "ไม่มีข้อมูลงานซ่อม" : "No repairs found"}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("orderId")}</th>
                    <th>{t("customer")}</th>
                    <th>{t("device")}</th>
                    <th>{t("issue")}</th>
                    <th>{t("estCost")}</th>
                    <th>{t("status")}</th>
                    <th>{t("tagLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairs.map((repair) => (
                    <tr key={repair.id}>
                      <td className="font-medium text-foreground">{repair.id}</td>
                      <td>
                        <div>
                          <p className="font-medium text-foreground">{repair.customer}</p>
                          <p className="text-xs text-muted-foreground">{repair.phone}</p>
                        </div>
                      </td>
                      <td>{repair.device}</td>
                      <td>{language === "th" ? repair.issueTh : repair.issue}</td>
                      <td>฿{repair.estimatedCost.toLocaleString()}</td>
                      <td>
                        <Select
                          value={repair.status}
                          onValueChange={(value) =>
                            handleQuickStatusChange(repair, value as "pending" | "in-progress" | "completed" | "cancelled" | "picked-up")
                          }
                        >
                          <SelectTrigger
                            className={`w-[140px] status-badge border-0 bg-transparent shadow-none hover:opacity-90 h-8 font-medium ${statusStyles[repair.status]}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in-progress">
                              {getRepairStatusLabel("in-progress", language)}
                            </SelectItem>
                            <SelectItem value="completed">
                              {getRepairStatusLabel("completed", language)}
                            </SelectItem>
                            <SelectItem value="picked-up">
                              {getRepairStatusLabel("picked-up", language)}
                            </SelectItem>
                            <SelectItem value="cancelled">
                              {getRepairStatusLabel("cancelled", language)}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        {repair.tag ? (
                          <span
                            className={
                              repair.tag === "endOfDay"
                                ? "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            }
                          >
                            {repair.tag === "endOfDay"
                              ? t("addQuickData")
                              : t("addRepairData")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-border">
              {filteredRepairs.map((repair) => (
                <div key={repair.id} className="p-4 space-y-3">
                  {/* Header: ID & View Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{repair.id}</p>
                      <div className="mt-1">
                        <p className="font-medium text-foreground">{repair.customer}</p>
                        <p className="text-xs text-muted-foreground">{repair.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Device & Issue */}
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">{t("device")}:</span>
                      <span className="text-foreground">{repair.device}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">{t("issue")}:</span>
                      <span className="text-foreground line-clamp-2">{language === "th" ? repair.issueTh : repair.issue}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[60px]">{t("estCost")}:</span>
                      <span className="font-semibold text-foreground">฿{repair.estimatedCost.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Status & Tag */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={repair.status}
                      onValueChange={(value) =>
                        handleQuickStatusChange(repair, value as "pending" | "in-progress" | "completed" | "cancelled" | "picked-up")
                      }
                    >
                      <SelectTrigger
                        className={`w-auto min-w-[120px] status-badge border-0 shadow-none hover:opacity-90 h-8 font-medium ${statusStyles[repair.status]}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-progress">
                          {getRepairStatusLabel("in-progress", language)}
                        </SelectItem>
                        <SelectItem value="completed">
                          {getRepairStatusLabel("completed", language)}
                        </SelectItem>
                        <SelectItem value="picked-up">
                          {getRepairStatusLabel("picked-up", language)}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {getRepairStatusLabel("cancelled", language)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {repair.tag && (
                      <span
                        className={
                          repair.tag === "endOfDay"
                            ? "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        }
                      >
                        {repair.tag === "endOfDay"
                          ? t("addQuickData")
                          : t("addRepairData")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        
        {/* Pagination - Responsive */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 border-t border-border">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {language === "th" 
                ? `แสดง ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalCount)} จาก ${pagination.totalCount} รายการ`
                : `Showing ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalCount)} of ${pagination.totalCount} items`}
            </div>
            <Pagination>
              <PaginationContent className="flex-wrap">
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (pagination.page > 1) {
                        handlePageChange(pagination.page - 1);
                      }
                    }}
                    disabled={pagination.page <= 1}
                    className="gap-1 h-8"
                    aria-label={language === "th" ? "หน้าก่อนหน้า" : "Go to previous page"}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{language === "th" ? "ก่อนหน้า" : "Previous"}</span>
                  </Button>
                </PaginationItem>
                
                {/* Page numbers - Hide some on mobile */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    pageNum === 1 ||
                    pageNum === pagination.totalPages ||
                    (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)
                  ) {
                    return (
                      <PaginationItem key={pageNum} className="hidden sm:inline-flex">
                        <Button
                          variant={pageNum === pagination.page ? "outline" : "ghost"}
                          size="icon"
                          onClick={() => handlePageChange(pageNum)}
                          className="h-8 w-8"
                          aria-current={pageNum === pagination.page ? "page" : undefined}
                        >
                          {pageNum}
                        </Button>
                      </PaginationItem>
                    );
                  } else if (pageNum === pagination.page - 2 || pageNum === pagination.page + 2) {
                    return (
                      <PaginationItem key={pageNum} className="hidden sm:inline-flex">
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}
                
                {/* Current page indicator for mobile */}
                <div className="sm:hidden text-sm px-3">
                  {pagination.page} / {pagination.totalPages}
                </div>
                
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (pagination.page < pagination.totalPages) {
                        handlePageChange(pagination.page + 1);
                      }
                    }}
                    disabled={pagination.page >= pagination.totalPages}
                    className="gap-1 h-8"
                    aria-label={language === "th" ? "หน้าถัดไป" : "Go to next page"}
                  >
                    <span className="hidden sm:inline">{language === "th" ? "ถัดไป" : "Next"}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Edit repair status dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          {editingRepair && (
            <>
              <DialogHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <DialogTitle>
                    {language === "th"
                      ? "แก้ไขสถานะการซ่อม"
                      : "Edit repair status"}
                  </DialogTitle>
                  <DialogDescription>
                    {language === "th"
                      ? "ปรับปรุงสถานะงานซ่อมโดยตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก"
                      : "Update repair status after reviewing order details."}
                  </DialogDescription>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("orderId")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {editingRepair.id}
                  </p>
                </div>
              </DialogHeader>

              <div className="grid gap-4 py-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("customer")}
                  </Label>
                  <p className="font-medium text-foreground">
                    {editingRepair.customer}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editingRepair.phone}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t("device")}
                  </Label>
                  <p className="font-medium text-foreground">
                    {editingRepair.device}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "th" ? "ราคาประมาณ" : "Estimated cost"}{" "}
                    ฿{editingRepair.estimatedCost.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    {t("issue")}
                  </Label>
                  <p className="text-foreground">
                    {language === "th"
                      ? editingRepair.issueTh
                      : editingRepair.issue}
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    {language === "th" ? "สถานะปัจจุบัน" : t("status")}
                  </Label>
                  <div className="flex flex-col gap-2">
                    <span
                      className={`status-badge ${
                        statusStyles[editingStatus]
                      }`}
                    >
                      {getRepairStatusLabel(editingStatus as any, language)}
                    </span>
                    <Select
                      value={editingStatus}
                      onValueChange={(value) =>
                        setEditingStatus(
                          value as
                            | "pending"
                            | "in-progress"
                            | "completed"
                            | "cancelled"
                            | "picked-up"
                        )
                      }
                    >
                      <SelectTrigger className="w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-progress">
                          {getRepairStatusLabel("in-progress", language)}
                        </SelectItem>
                        <SelectItem value="completed">
                          {getRepairStatusLabel("completed", language)}
                        </SelectItem>
                        <SelectItem value="picked-up">
                          {getRepairStatusLabel("picked-up", language)}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {getRepairStatusLabel("cancelled", language)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editingStatus === "cancelled" && (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">
                      {t("cancelReason")}
                    </Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder={t("enterCancelReason")}
                      className="min-h-[80px]"
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => setConfirmSaveOpen(true)}
                >
                  {language === "th" ? "บันทึก" : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* กรอกเหตุผลเมื่อเลือกสถานะ "ยกเลิก" จากตาราง */}
      <Dialog
        open={cancelReasonOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCancelReasonOpen(false);
            setPendingStatusChange(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {language === "th" ? "เหตุผลการยกเลิก (ถ้ามี)" : "Cancel reason (optional)"}
            </DialogTitle>
            <DialogDescription>
              {language === "th"
                ? "กรอกเหตุผลแล้วกดถัดไป เพื่อยืนยันการเปลี่ยนสถานะ"
                : "Enter reason then click Next to confirm status change."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("enterCancelReason")}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelReasonOpen(false);
                setPendingStatusChange(null);
                setCancelReason("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                setCancelReasonOpen(false);
                setConfirmSaveOpen(true);
              }}
            >
              {language === "th" ? "ถัดไป" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันรหัสผ่านก่อนบันทึกสถานะ */}
      <Dialog open={confirmSaveOpen} onOpenChange={(open) => {
        setConfirmSaveOpen(open);
        if (!open) {
          setConfirmPassword("");
          if (!editingRepair) setPendingStatusChange(null);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{language === "th" ? "ยืนยันการอัปเดตสถานะ" : "Confirm Status Update"}</DialogTitle>
            <DialogDescription>
              {language === "th" 
                ? "กรอกรหัสผ่านเพื่อยืนยันการอัปเดตสถานะการซ่อม"
                : "Enter your password to confirm the repair status update"}
              {pendingStatusChange && (
                <span className="mt-2 block font-medium text-foreground">
                  {language === "th" ? "คำสั่งซ่อม " : "Order "}
                  {pendingStatusChange.repair.id}
                  {" → "}
                  {statusLabels[pendingStatusChange.newStatus]}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("password")}</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={language === "th" ? "กรอกรหัสผ่านที่ใช้เข้าสู่ระบบ" : "Enter your login password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyStatusUpdate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmSaveOpen(false);
                setConfirmPassword("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={applyStatusUpdate}
              disabled={!confirmPassword}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Repairs;
