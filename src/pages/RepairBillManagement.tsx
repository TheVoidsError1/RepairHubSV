/**
 * หน้าจัดการใบแจ้งซ่อม
 * ให้พนักงานสามารถดู แก้ไข และพิมพ์ใบแจ้งซ่อมได้
 */
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs, type RepairItem } from "@/contexts/RepairsContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { repairItemToBillData } from "@/types/repairOrder";
import { ArrowLeft, Edit, Eye, FileText, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [1, 5, 10] as const;

const RepairBillManagement = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { repairs, refreshRepairs } = useRepairs();
  const { toast } = useToast();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairItem | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRepair, setIsLoadingRepair] = useState(false);

  // Part selection dialog state
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false);
  const [partSearchQuery, setPartSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [partsList, setPartsList] = useState<any[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRepair, setDeletingRepair] = useState<RepairItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter repairs by search query
  const filteredRepairs = repairs.filter((repair) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      repair.id.toLowerCase().includes(query) ||
      repair.customer.toLowerCase().includes(query) ||
      repair.phone.toLowerCase().includes(query) ||
      repair.device.toLowerCase().includes(query) ||
      (repair.issueTh && repair.issueTh.toLowerCase().includes(query)) ||
      (repair.issue && repair.issue.toLowerCase().includes(query))
    );
  });
  
  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredRepairs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRepairs = filteredRepairs.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleViewBill = (item: RepairItem) => {
    const orderData = repairItemToBillData(item, language);
    navigate("/repairs/bill/order", { 
      state: { 
        ...orderData, 
        repairId: item.id,
        selectedPart: item.selectedPart,
        selectedParts: item.selectedParts || (item.selectedPart ? [item.selectedPart] : undefined),
        additionalParts: item.additionalParts || undefined,
        returnTo: "/repairs/bill/management", // กลับไปที่จัดการใบแจ้งซ่อม
      } 
    });
  };

  const handleViewReceipt = (item: RepairItem) => {
    const orderData = repairItemToBillData(item, language);
    navigate("/repairs/bill/receipt", { 
      state: { 
        ...orderData, 
        repairId: item.id,
        selectedPart: item.selectedPart,
        selectedParts: item.selectedParts || (item.selectedPart ? [item.selectedPart] : undefined),
        additionalParts: item.additionalParts || undefined,
        returnTo: "/repairs/bill/management", // กลับไปที่จัดการใบแจ้งซ่อม
      } 
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingRepair) return;
    setIsDeleting(true);
    try {
      const response = await apiClient.deleteRepair(deletingRepair.id);
      
      // ตรวจสอบว่า response status เป็น success หรือไม่
      if (response.status === 'error') {
        throw new Error(response.message || (language === "th" ? "ลบใบแจ้งซ่อมไม่สำเร็จ" : "Failed to delete repair bill"));
      }
      
      // ลบสำเร็จแล้ว refresh ข้อมูล
      await refreshRepairs();
      setDeleteDialogOpen(false);
      setDeletingRepair(null);
      toast({
        title: language === "th" ? "ลบใบแจ้งซ่อมแล้ว" : "Repair bill deleted",
        description: language === "th" ? `ลบ ${deletingRepair.id} เรียบร้อย` : `${deletingRepair.id} has been deleted.`,
      });
    } catch (err: any) {
      console.error('Error deleting repair:', err);
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: err?.message || (language === "th" ? "ลบใบแจ้งซ่อมไม่สำเร็จ" : "Failed to delete repair bill"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateForInput = (d: Date | string | undefined) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const formatTimeHHmm = (t: string | undefined) => (t && /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5) : "");

  const handleEditBill = async (item: RepairItem) => {
    setIsLoadingRepair(true);
    setEditingRepair(item);
    try {
      const response = await apiClient.getRepairById(item.id);
      if (response.status === 'success' && response.data) {
        const repair = response.data;
        const customer = repair.customer || {};
        const customerName = customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "";
        setEditFormData({
          customerId: repair.customer?.id ?? null,
          customerName: customerName || item.customer,
          phone: customer.phone ?? repair.phone ?? item.phone ?? "",
          phoneBackup: customer.phoneBackup ?? "",
          lineId: customer.lineId ?? "",
          deviceType: repair.deviceType ?? "",
          deviceModel: repair.deviceModel ?? repair.deviceBrand ?? item.device ?? "",
          serialNumber: repair.serialNumber ?? repair.deviceSerialNumber ?? item.serialNumber ?? "",
          deviceColor: repair.deviceColor ?? "",
          screenLockCode: repair.screenLockCode ?? "",
          problemSymptoms: repair.problemSymptoms ?? repair.problemDescription ?? "",
          diagnosis: repair.diagnosis ?? "",
          repairNotes: repair.repairNotes ?? "",
          deposit: repair.deposit ?? 0,
          estimatedPrice: repair.estimatedPrice ?? 0,
          repairSummaryPrice: repair.repairSummaryPrice ?? repair.totalCost ?? 0,
          warrantyDays: repair.warrantyDays ?? 90,
          serviceType: repair.serviceType ?? "walk_in",
          dateOfReport: formatDateForInput(repair.dateOfReport),
          timeOfReport: formatTimeHHmm(repair.timeOfReport) || (repair.timeOfReport && String(repair.timeOfReport).slice(0, 5)) || "",
          receiveDate: formatDateForInput(repair.receiveDate) || formatDateForInput(repair.dateOfReport),
          receiveTime: formatTimeHHmm(repair.receiveTime) || formatTimeHHmm(repair.timeOfReport) || (repair.receiveTime && String(repair.receiveTime).slice(0, 5)) || "",
          scheduledPickupTime: repair.scheduledPickupTime
            ? (() => {
                const d = new Date(repair.scheduledPickupTime);
                return isNaN(d.getTime()) ? "" : d.toLocaleString(language === "th" ? "th-TH" : "en-GB", { dateStyle: "short", timeStyle: "short" });
              })()
            : "",
          status: repair.status ?? item.status,
          selectedParts: repair.selectedParts || [],
          additionalParts: repair.additionalParts || [],
        });
        setEditDialogOpen(true);
      } else {
        setEditFormData({
          customerName: item.customer,
          phone: item.phone ?? "",
          deviceModel: item.device ?? "",
          serialNumber: item.serialNumber ?? "",
          deviceColor: "",
          screenLockCode: "",
          problemSymptoms: language === "th" ? item.issueTh : item.issue,
          estimatedPrice: item.estimatedCost,
          repairSummaryPrice: item.estimatedCost,
          selectedParts: item.selectedParts || [],
          additionalParts: item.additionalParts || [],
        });
        setEditDialogOpen(true);
      }
    } catch (error) {
      console.error('Error loading repair data:', error);
      setEditFormData({
        customerName: item.customer,
        phone: item.phone ?? "",
        deviceModel: item.device ?? "",
        serialNumber: item.serialNumber ?? "",
        deviceColor: "",
        screenLockCode: "",
        problemSymptoms: language === "th" ? item.issueTh : item.issue,
        estimatedPrice: item.estimatedCost,
        repairSummaryPrice: item.estimatedCost,
        selectedParts: item.selectedParts || [],
        additionalParts: item.additionalParts || [],
      });
      setEditDialogOpen(true);
    } finally {
      setIsLoadingRepair(false);
    }
  };

  // Calculate total price from parts
  const calculateTotalPrice = () => {
    let total = 0;
    if (editFormData.selectedParts && Array.isArray(editFormData.selectedParts)) {
      total += editFormData.selectedParts.reduce((sum: number, part: any) => {
        return sum + (parseFloat(String(part.price || 0)) || 0);
      }, 0);
    }
    if (editFormData.additionalParts && Array.isArray(editFormData.additionalParts)) {
      total += editFormData.additionalParts.reduce((sum: number, part: any) => {
        return sum + (parseFloat(String(part.price || 0)) || 0);
      }, 0);
    }
    return total;
  };

  // Load parts from API
  const loadParts = async () => {
    setIsLoadingParts(true);
    try {
      const response = await apiClient.getParts();
      if (response.status === 'success' && response.data) {
        setPartsList(response.data);
      }
    } catch (error) {
      console.error('Error loading parts:', error);
    } finally {
      setIsLoadingParts(false);
    }
  };

  // Load parts when part dialog opens
  useEffect(() => {
    if (isPartDialogOpen) {
      loadParts();
    }
  }, [isPartDialogOpen]);

  // Update price when parts change
  useEffect(() => {
    if (editDialogOpen && editFormData) {
      const totalPrice = calculateTotalPrice();
      if (totalPrice > 0) {
        setEditFormData((prev: any) => ({
          ...prev,
          estimatedPrice: totalPrice,
          repairSummaryPrice: totalPrice,
        }));
      }
    }
  }, [editFormData?.selectedParts, editFormData?.additionalParts, editDialogOpen]);

  // Get unique categories from parts
  const getUniqueCategories = () => {
    const categories = new Map<string, { name: string; nameTh: string; count: number }>();
    partsList.forEach((part: any) => {
      const categoryKey = part.category || "Others";
      const categoryTh = part.categoryTh || "อื่นๆ";
      if (!categories.has(categoryKey)) {
        categories.set(categoryKey, {
          name: categoryKey,
          nameTh: categoryTh,
          count: 0,
        });
      }
      const cat = categories.get(categoryKey)!;
      cat.count += 1;
    });
    return Array.from(categories.values()).sort((a, b) => 
      language === "th" ? a.nameTh.localeCompare(b.nameTh) : a.name.localeCompare(b.name)
    );
  };

  // Get parts filtered by selected category
  const getPartsByCategory = (category: string | null) => {
    if (!category) return [];
    return partsList.filter((part: any) => {
      const partCategory = part.category || "Others";
      return partCategory === category;
    });
  };

  // Filter parts based on search query and selected category
  const filteredAvailableParts = (() => {
    let parts = selectedCategory 
      ? getPartsByCategory(selectedCategory)
      : partsList;
    
    if (partSearchQuery.trim()) {
      const query = partSearchQuery.toLowerCase();
      parts = parts.filter((part: any) => {
        const nameMatch = part.name?.toLowerCase().includes(query);
        const nameThMatch = part.nameTh?.toLowerCase().includes(query);
        const categoryMatch = part.category?.toLowerCase().includes(query);
        return nameMatch || nameThMatch || categoryMatch;
      });
    }
    
    return parts;
  })();

  // Get stock status
  const getPartStockStatus = (stock: number) => {
    if (stock === 0) return "out";
    if (stock <= 5) return "low";
    return "high";
  };

  const handleAddPartFromInventory = (partId: string) => {
    const part = partsList.find((p: any) => p.id === partId);
    if (part) {
      const newSelectedParts = [...(editFormData.selectedParts || [])];
      // Check if part already exists
      if (!newSelectedParts.find((p: any) => p.id === partId)) {
        newSelectedParts.push({
          id: part.id,
          partNumber: part.partNumber,
          name: part.name,
          nameTh: part.nameTh || part.name,
          price: part.price,
        });
        setEditFormData({ ...editFormData, selectedParts: newSelectedParts });
      }
      setIsPartDialogOpen(false);
      setPartSearchQuery("");
      setSelectedCategory(null);
    }
  };

  const handleRemovePartFromInventory = (partId: string) => {
    const newSelectedParts = (editFormData.selectedParts || []).filter((p: any) => p.id !== partId);
    setEditFormData({ ...editFormData, selectedParts: newSelectedParts });
  };

  const handleSaveEdit = async () => {
    if (!editingRepair) return;

    setIsSaving(true);
    try {
      const totalPrice = calculateTotalPrice();
      const taxRate = 0.07;
      const subtotal = totalPrice;
      const totalCost = subtotal * (1 + taxRate);

      if (editFormData.customerId && (editFormData.customerName ?? editFormData.phone ?? editFormData.lineId)) {
        const nameParts = (editFormData.customerName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || (editFormData.customerName || "").trim();
        const lastName = nameParts.slice(1).join(" ") || undefined;
        await apiClient.updateCustomer(editFormData.customerId, {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: (editFormData.phone || "").trim() || undefined,
          lineId: (editFormData.lineId || "").trim() || undefined,
        });
      }

      const receiveDate = (editFormData.receiveDate || "").trim();
      const receiveTime = (editFormData.receiveTime || "").trim().slice(0, 5);
      const scheduledPickupIso =
        receiveDate && receiveTime ? `${receiveDate}T${receiveTime}:00` : undefined;

      const updateData: any = {
        deviceModel: (editFormData.deviceModel || "").trim() || undefined,
        serialNumber: (editFormData.serialNumber || "").trim() || undefined,
        deviceColor: (editFormData.deviceColor || "").trim() || undefined,
        screenLockCode: (editFormData.screenLockCode || "").trim() || undefined,
        problemSymptoms: (editFormData.problemSymptoms || "").trim() || undefined,
        dateOfReport: (editFormData.dateOfReport || "").trim() || undefined,
        timeOfReport: (editFormData.timeOfReport || "").trim().slice(0, 5) || undefined,
        receiveDate: receiveDate || undefined,
        receiveTime: receiveTime || undefined,
        scheduledPickupTime: scheduledPickupIso,
        warrantyDays: editFormData.warrantyDays != null ? Number(editFormData.warrantyDays) : undefined,
        deposit: editFormData.deposit != null && editFormData.deposit !== "" ? Number(editFormData.deposit) : undefined,
        serviceType: editFormData.serviceType || undefined,
        estimatedPrice: totalPrice > 0 ? totalPrice : editFormData.estimatedPrice,
        repairSummaryPrice: totalPrice > 0 ? totalPrice : editFormData.repairSummaryPrice,
        totalCost: totalPrice > 0 ? totalCost : undefined,
        partsCost: totalPrice > 0 ? subtotal : undefined,
        additionalParts: editFormData.additionalParts && editFormData.additionalParts.length > 0 ? editFormData.additionalParts : undefined,
      };

      if (editFormData.selectedParts && Array.isArray(editFormData.selectedParts) && editFormData.selectedParts.length > 0) {
        const partIds = editFormData.selectedParts.map((part: any) => part.id).filter((id: any) => id);
        if (partIds.length > 0) updateData.selectedPartIds = partIds;
      }

      const response = await apiClient.updateRepair(editingRepair.id, updateData);
      if (response.status === "success") {
        toast({
          title: language === "th" ? "บันทึกสำเร็จ" : "Saved successfully",
          description: language === "th" 
            ? "อัพเดทใบแจ้งซ่อมเรียบร้อยแล้ว กำลังแสดงบิลที่อัพเดทล่าสุด..." 
            : "Repair bill updated successfully. Showing latest bill...",
        });
        setEditDialogOpen(false);
        setEditingRepair(null);
        await refreshRepairs();
        
        // Load updated repair data and navigate to bill view
        try {
          const updatedRepairResponse = await apiClient.getRepairById(editingRepair.id);
          if (updatedRepairResponse.status === 'success' && updatedRepairResponse.data) {
            const updatedRepair = updatedRepairResponse.data;
            const updatedItem = repairs.find(r => r.id === editingRepair.id);
            if (updatedItem) {
              const orderData = repairItemToBillData(updatedItem, language);
              navigate("/repairs/bill/order", { 
                state: { 
                  ...orderData, 
                  repairId: updatedItem.id,
                  selectedParts: updatedRepair.selectedParts || [],
                  additionalParts: updatedRepair.additionalParts || [],
                  returnTo: "/repairs/bill/management", // กลับไปที่จัดการใบแจ้งซ่อม
                } 
              });
            }
          }
        } catch (error) {
          console.error('Error loading updated repair:', error);
        }
      } else {
        toast({
          title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
          description: response.message || (language === "th" ? "ไม่สามารถบันทึกได้" : "Failed to save"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: error instanceof Error 
          ? error.message 
          : (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">
              {language === "th" ? "จัดการใบแจ้งซ่อม" : "Repair Bill Management"}
            </h1>
            <p className="page-description">
              {language === "th"
                ? "ดู แก้ไข และพิมพ์ใบแจ้งซ่อมทั้งหมด"
                : "View, edit, and print all repair bills."}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  {language === "th" ? "รายการใบแจ้งซ่อม" : "Repair Bills List"}
                </CardTitle>
                <CardDescription>
                  {language === "th"
                    ? "คลิกดูรายละเอียดเพื่อดูหรือพิมพ์ใบแจ้งซ่อม"
                    : "Click view details to view or print repair bills."}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-initial sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={language === "th" ? "ค้นหา..." : "Search..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRepairs.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                {searchQuery
                  ? (language === "th" ? "ไม่พบผลการค้นหา" : "No search results found.")
                  : (language === "th" ? "ยังไม่มีใบแจ้งซ่อมในระบบ" : "No repair bills in the system.")}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left p-3 font-medium">{t("orderId")}</th>
                        <th className="text-left p-3 font-medium">{t("customer")}</th>
                        <th className="text-left p-3 font-medium">{t("device")}</th>
                        <th className="text-left p-3 font-medium">{t("issue")}</th>
                        <th className="text-right p-3 font-medium">{t("estCost")}</th>
                        <th className="text-center p-3 font-medium">
                          {language === "th" ? "สถานะ" : "Status"}
                        </th>
                        <th className="text-center p-3 font-medium w-[10rem]">
                          {language === "th" ? "จัดการ" : "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRepairs.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          <td className="p-3 font-mono text-muted-foreground">{item.id}</td>
                          <td className="p-3">
                            <div className="font-medium">{item.customer}</div>
                            {item.phone && (
                              <div className="text-xs mt-0.5 text-muted-foreground">{item.phone}</div>
                            )}
                          </td>
                          <td className="p-3">{item.device}</td>
                          <td className="p-3">
                            <div className="max-w-xs truncate">
                              {language === "th" ? item.issueTh : item.issue}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            ฿{item.estimatedCost.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                item.status === "completed" || item.status === "picked-up"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : item.status === "in-progress" || item.status === "pending"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                              )}
                            >
                              {item.status === "completed"
                                ? language === "th" ? "เสร็จสิ้น" : "Completed"
                                : item.status === "picked-up"
                                ? language === "th" ? "รับเครื่องแล้ว" : "Picked Up"
                                : item.status === "in-progress" || item.status === "pending"
                                ? language === "th" ? "กำลังซ่อม" : "In Progress"
                                : item.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handleViewBill(item)}
                                      aria-label={language === "th" ? "ดูใบแจ้งซ่อม" : "View Bill"}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {language === "th" ? "ดูใบแจ้งซ่อม" : "View Bill"}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handleViewReceipt(item)}
                                      aria-label={language === "th" ? "ดูใบเสร็จ" : "View Receipt"}
                                    >
                                      <Receipt className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {language === "th" ? "ดูใบเสร็จ" : "View Receipt"}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handleEditBill(item)}
                                      aria-label={language === "th" ? "แก้ไข" : "Edit"}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {language === "th" ? "แก้ไข" : "Edit"}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setDeletingRepair(item);
                                        setDeleteDialogOpen(true);
                                      }}
                                      aria-label={language === "th" ? "ลบ" : "Delete"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {language === "th" ? "ลบ" : "Delete"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Footer: รายการต่อหน้า + สรุป + Pagination */}
                {filteredRepairs.length > 0 && (
                  <div className="border-t border-border p-4 mt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {language === "th" ? "แสดง" : "Show"}
                        </span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          className="h-8 w-14 rounded-md border border-input bg-transparent px-2 text-sm"
                        >
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {language === "th" ? "รายการต่อหน้า" : "per page"}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {language === "th"
                          ? `แสดง ${startIndex + 1}-${Math.min(endIndex, filteredRepairs.length)} จาก ${filteredRepairs.length} รายการ`
                          : `Showing ${startIndex + 1}-${Math.min(endIndex, filteredRepairs.length)} of ${filteredRepairs.length} items`}
                      </div>
                    </div>
                    {totalPages > 1 && (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => {
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              className={
                                currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => {
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                              }}
                              className={
                                currentPage === totalPages
                                  ? "pointer-events-none opacity-50"
                                  : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Bill Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            {editingRepair && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {language === "th" ? "แก้ไขใบแจ้งซ่อม" : "Edit Repair Bill"}
                  </DialogTitle>
                  <DialogDescription>
                    {language === "th"
                      ? `แก้ไขข้อมูลใบแจ้งซ่อม ${editingRepair.id}`
                      : `Edit repair bill ${editingRepair.id}`}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "ชื่อลูกค้า" : "Customer name"}</Label>
                      <Input
                        value={editFormData.customerName || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                        placeholder={language === "th" ? "ชื่อลูกค้า" : "Name"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "เบอร์โทร" : "Phone"}</Label>
                      <Input
                        value={editFormData.phone || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        placeholder="084-xxx-xxxx"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-sm">LINE ID</Label>
                      <Input
                        value={editFormData.lineId || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, lineId: e.target.value })}
                        placeholder="LINE ID"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "รุ่น/อุปกรณ์" : "Model"}</Label>
                      <Input
                        value={editFormData.deviceModel || editFormData.deviceType || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, deviceModel: e.target.value })}
                        placeholder={language === "th" ? "รุ่นเครื่อง" : "Model"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "IMEI / Serial" : "IMEI / Serial"}</Label>
                      <Input
                        value={editFormData.serialNumber || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, serialNumber: e.target.value })}
                        placeholder="IMEI หรือ Serial"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "สี" : "Color"}</Label>
                      <Input
                        value={editFormData.deviceColor || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, deviceColor: e.target.value })}
                        placeholder={language === "th" ? "เช่น สีดำ" : "e.g. Black"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "รหัสล็อคหน้าจอ" : "Screen lock"}</Label>
                      <Input
                        value={editFormData.screenLockCode || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, screenLockCode: e.target.value })}
                        placeholder="1234"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "วันที่แจ้งซ่อม" : "Report date"}</Label>
                      <Input
                        type="date"
                        value={editFormData.dateOfReport || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, dateOfReport: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "เวลาแจ้งซ่อม" : "Report time"}</Label>
                      <Input
                        type="time"
                        value={editFormData.timeOfReport || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, timeOfReport: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "นัดรับเครื่อง (วันที่)" : "Pickup date"}</Label>
                      <Input
                        type="date"
                        value={editFormData.receiveDate || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, receiveDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "นัดรับเครื่อง (เวลา)" : "Pickup time"}</Label>
                      <Input
                        type="time"
                        value={editFormData.receiveTime || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, receiveTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "รับประกัน (วัน)" : "Warranty (days)"}</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={editFormData.warrantyDays ?? 90}
                        onChange={(e) => setEditFormData({ ...editFormData, warrantyDays: Number(e.target.value) })}
                      >
                        <option value={30}>{language === "th" ? "30 วัน (1 เดือน)" : "30 days (1 month)"}</option>
                        <option value={90}>{language === "th" ? "90 วัน (3 เดือน)" : "90 days"}</option>
                        <option value={180}>{language === "th" ? "180 วัน (6 เดือน)" : "180 days"}</option>
                        <option value={365}>{language === "th" ? "365 วัน (1 ปี)" : "365 days"}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "ประเภทบริการ" : "Service type"}</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={editFormData.serviceType || "walk_in"}
                        onChange={(e) => setEditFormData({ ...editFormData, serviceType: e.target.value })}
                      >
                        <option value="walk_in">{language === "th" ? "รับหน้าร้าน" : "Walk-in"}</option>
                        <option value="drop_off">{language === "th" ? "ฝากเครื่อง" : "Drop-off"}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">{language === "th" ? "มัดจำ (บาท)" : "Deposit"}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editFormData.deposit != null ? editFormData.deposit : ""}
                        onChange={(e) => setEditFormData({ ...editFormData, deposit: e.target.value === "" ? "" : Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{language === "th" ? "อาการเสีย" : "Problem symptoms"}</Label>
                    <Textarea
                      value={editFormData.problemSymptoms || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, problemSymptoms: e.target.value })}
                      rows={2}
                      placeholder={language === "th" ? "อธิบายอาการเสีย..." : "Describe the problem..."}
                      className="resize-none"
                    />
                  </div>

                  {/* ─── ชิ้นส่วนและอะไหล่ ─── */}
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      {language === "th" ? "ชิ้นส่วนและอะไหล่" : "Parts & accessories"}
                    </p>

                    {/* จากคลังสินค้า */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {language === "th" ? "จากคลังสินค้า" : "From inventory"}
                      </p>
                      {editFormData.selectedParts && editFormData.selectedParts.length > 0 ? (
                        <ul className="space-y-1.5">
                          {editFormData.selectedParts.map((part: any, index: number) => (
                            <li
                              key={part.id || index}
                              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium">{part.nameTh || part.name}</span>
                                {part.partNumber && (
                                  <span className="ml-2 text-xs text-muted-foreground">({part.partNumber})</span>
                                )}
                              </div>
                              <span className="shrink-0 font-medium tabular-nums">฿{parseFloat(String(part.price || 0)).toLocaleString()}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemovePartFromInventory(part.id)}
                                aria-label={language === "th" ? "ลบ" : "Remove"}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 px-3 py-2 text-center text-sm text-muted-foreground">
                          {language === "th" ? "ยังไม่ได้เลือกชิ้นส่วนจากคลัง" : "No parts from inventory"}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPartDialogOpen(true)}
                        className="w-full border-dashed"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {language === "th" ? "เลือกชิ้นส่วนจากคลังสินค้า" : "Select from inventory"}
                      </Button>
                    </div>

                    {/* ชิ้นส่วนเพิ่มเติม (ไม่มีในคลัง) */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {language === "th" ? "ชิ้นส่วนเพิ่มเติม (ไม่มีในคลัง)" : "Additional parts (not in stock)"}
                      </p>
                      {((editFormData.additionalParts as any[]) || []).length > 0 ? (
                        <div className="overflow-hidden rounded-md border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40">
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  {language === "th" ? "ชื่อชิ้นส่วน" : "Part name"}
                                </th>
                                <th className="hidden sm:table-cell w-36 px-3 py-2 text-left font-medium text-muted-foreground">
                                  {language === "th" ? "ชื่อไทย" : "Name (Thai)"}
                                </th>
                                <th className="w-24 px-3 py-2 text-right font-medium text-muted-foreground">
                                  {language === "th" ? "ราคา" : "Price"}
                                </th>
                                <th className="w-10 px-2 py-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {((editFormData.additionalParts as any[]) || []).map((part, index) => (
                                <tr key={index} className="border-b border-border/50 last:border-0">
                                  <td className="px-3 py-2">
                                    <Input
                                      value={part.name || ""}
                                      onChange={(e) => {
                                        const newParts = [...((editFormData.additionalParts as any[]) || [])];
                                        newParts[index] = { ...newParts[index], name: e.target.value };
                                        setEditFormData({ ...editFormData, additionalParts: newParts });
                                      }}
                                      placeholder={language === "th" ? "ชื่อชิ้นส่วน" : "Part name"}
                                      className="h-8 text-sm"
                                    />
                                  </td>
                                  <td className="hidden sm:table-cell px-3 py-2">
                                    <Input
                                      value={part.nameTh || ""}
                                      onChange={(e) => {
                                        const newParts = [...((editFormData.additionalParts as any[]) || [])];
                                        newParts[index] = { ...newParts[index], nameTh: e.target.value };
                                        setEditFormData({ ...editFormData, additionalParts: newParts });
                                      }}
                                      placeholder={language === "th" ? "ชื่อไทย" : "Thai"}
                                      className="h-8 text-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={part.price || 0}
                                      onChange={(e) => {
                                        const newParts = [...((editFormData.additionalParts as any[]) || [])];
                                        newParts[index] = { ...newParts[index], price: parseFloat(e.target.value) || 0 };
                                        setEditFormData({ ...editFormData, additionalParts: newParts });
                                      }}
                                      className="h-8 text-sm text-right tabular-nums"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        const newParts = [...((editFormData.additionalParts as any[]) || [])];
                                        newParts.splice(index, 1);
                                        setEditFormData({ ...editFormData, additionalParts: newParts });
                                      }}
                                      aria-label={language === "th" ? "ลบแถว" : "Remove row"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newParts = [...((editFormData.additionalParts as any[]) || [])];
                          newParts.push({ name: "", nameTh: "", price: 0 });
                          setEditFormData({ ...editFormData, additionalParts: newParts });
                        }}
                        className="w-full border-dashed"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {language === "th" ? "เพิ่มชิ้นส่วนใหม่ (ไม่มีในคลัง)" : "Add part (not in stock)"}
                      </Button>
                    </div>

                    {/* สรุปราคา */}
                    <div className="flex justify-between border-t border-border pt-3 text-sm">
                      <span className="font-medium text-muted-foreground">
                        {language === "th" ? "รวมราคาชิ้นส่วน" : "Total parts"}
                      </span>
                      <span className="font-semibold tabular-nums">฿{calculateTotalPrice().toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Price Summary (legacy - keep for consistency with rest of form) */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{language === "th" ? "รวมราคาชิ้นส่วน" : "Total Parts Price"}</span>
                      <span className="font-semibold text-lg">
                        ฿{calculateTotalPrice().toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>{language === "th" ? "ประเมินราคา" : "Estimated Price"}</span>
                      <span>฿{parseFloat(String(editFormData.estimatedPrice || 0)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>{language === "th" ? "รวมทั้งสิ้น" : "Total"}</span>
                      <span>฿{calculateTotalPrice().toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setEditingRepair(null);
                    }}
                    disabled={isSaving}
                  >
                    {language === "th" ? "ยกเลิก" : "Cancel"}
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isSaving || isLoadingRepair}>
                    {isSaving
                      ? (language === "th" ? "กำลังบันทึก..." : "Saving...")
                      : (language === "th" ? "บันทึก" : "Save")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Part Selection Dialog */}
        <Dialog open={isPartDialogOpen} onOpenChange={setIsPartDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === "th" ? "เลือกชิ้นส่วนจากคลังสินค้า" : "Select Parts from Inventory"}
              </DialogTitle>
              <DialogDescription>
                {language === "th"
                  ? "เลือกชิ้นส่วนที่ต้องการเพิ่มในใบแจ้งซ่อม"
                  : "Select parts to add to the repair bill"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!selectedCategory ? (
                // Step 1: Show categories
                <Command className="rounded-lg border shadow-md">
                  <CommandInput
                    placeholder={language === "th" ? "ค้นหาหมวดหมู่..." : "Search categories..."}
                    value={partSearchQuery}
                    onValueChange={setPartSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {language === "th" ? "ไม่พบหมวดหมู่" : "No categories found"}
                    </CommandEmpty>
                    <CommandGroup heading={language === "th" ? "หมวดหมู่" : "Categories"}>
                      {getUniqueCategories()
                        .filter((cat) => {
                          if (!partSearchQuery.trim()) return true;
                          const query = partSearchQuery.toLowerCase();
                          return cat.name.toLowerCase().includes(query) || 
                                 cat.nameTh.toLowerCase().includes(query);
                        })
                        .map((category) => (
                          <CommandItem
                            key={category.name}
                            value={category.name}
                            onSelect={() => setSelectedCategory(category.name)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <span className="font-medium">
                                {language === "th" ? category.nameTh : category.name}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({category.count} {language === "th" ? "รายการ" : "items"})
                              </span>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              ) : (
                // Step 2: Show parts in selected category
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(null);
                      setPartSearchQuery("");
                    }}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {language === "th" ? "กลับไปหมวดหมู่" : "Back to Categories"}
                  </Button>
                  <Command className="rounded-lg border shadow-md">
                    <CommandInput
                      placeholder={language === "th" ? "พิมพ์ชื่ออะไหล่..." : "Type part name..."}
                      value={partSearchQuery}
                      onValueChange={setPartSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {language === "th" ? "ไม่พบอะไหล่" : "No parts found"}
                      </CommandEmpty>
                      <CommandGroup heading={language === "th" ? "อะไหล่ที่เลือกได้" : "Available Parts"}>
                        {filteredAvailableParts.map((part: any) => {
                          const stockStatus = getPartStockStatus(part.stockQuantity || 0);
                          const isAlreadySelected = editFormData.selectedParts?.some((p: any) => p.id === part.id);
                          return (
                            <CommandItem
                              key={part.id}
                              value={part.id}
                              onSelect={() => !isAlreadySelected && handleAddPartFromInventory(part.id)}
                              disabled={isAlreadySelected}
                              className={cn(
                                "flex items-center justify-between cursor-pointer",
                                isAlreadySelected && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex flex-col gap-1 flex-1">
                                <span className="font-medium">
                                  {language === "th" ? part.nameTh || part.name : part.name || part.nameTh}
                                </span>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span>
                                    {language === "th" ? "สต็อก" : "Stock"}: {part.stockQuantity || 0}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      stockStatus === "high" &&
                                        "border-green-500/60 bg-green-500/15 text-green-700 dark:text-green-400",
                                      stockStatus === "low" &&
                                        "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                      stockStatus === "out" &&
                                        "border-destructive/60 bg-destructive/15 text-destructive"
                                    )}
                                  >
                                    {stockStatus === "high" && (language === "th" ? "พอใช้" : "In Stock")}
                                    {stockStatus === "low" && (language === "th" ? "น้อย" : "Low")}
                                    {stockStatus === "out" && (language === "th" ? "หมด" : "Out")}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary">
                                  ฿{Number(part.price || 0).toLocaleString()}
                                </span>
                                {isAlreadySelected && (
                                  <Badge variant="outline" className="text-xs">
                                    {language === "th" ? "เลือกแล้ว" : "Selected"}
                                  </Badge>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPartDialogOpen(false)}>
                {language === "th" ? "ปิด" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === "th" ? "ลบใบแจ้งซ่อม" : "Delete repair bill"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === "th"
                  ? `คุณแน่ใจหรือไม่ว่าต้องการลบใบแจ้งซ่อม ${deletingRepair?.id}? การกระทำนี้ไม่สามารถยกเลิกได้`
                  : `Are you sure you want to delete repair bill ${deletingRepair?.id}? This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmDelete();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (language === "th" ? "กำลังลบ..." : "Deleting...") : language === "th" ? "ลบ" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default RepairBillManagement;
