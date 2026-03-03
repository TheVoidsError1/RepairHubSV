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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiClient } from "@/lib/api";
import { Edit, Eye, MessageSquare, Phone, Plus, Search, Trash2, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Customer {
  id: string;
  firstName: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  lineId?: string;
  lineIdRes?: string;
  device?: string;
  createdAt: string;
  updatedAt: string;
}

const Customers = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [repairsCount, setRepairsCount] = useState<number>(0);
  const [isLoadingRepairsCount, setIsLoadingRepairsCount] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    lineId: "",
    device: "",
  });


  const ITEMS_PER_PAGE = 8;

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getCustomers();
      if (response.status === "success" && response.data) {
        setCustomers(response.data);
      } else {
        toast.error(
          response.message ||
            (language === "th"
              ? "ไม่สามารถโหลดข้อมูลลูกค้าได้"
              : "Failed to load customers")
        );
      }
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error(
        language === "th"
          ? "เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า"
          : "Error loading customers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on("customer:created", loadCustomers);
    socket.on("customer:updated", loadCustomers);
    socket.on("customer:deleted", loadCustomers);

    return () => {
      socket.off("customer:created", loadCustomers);
      socket.off("customer:updated", loadCustomers);
      socket.off("customer:deleted", loadCustomers);
    };
  }, [socket, isConnected]);

  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const fullName =
      customer.fullName ||
      `${customer.firstName} ${customer.lastName || ""}`.trim();
    return (
      customer.firstName?.toLowerCase().includes(term) ||
      customer.lastName?.toLowerCase().includes(term) ||
      fullName.toLowerCase().includes(term) ||
      customer.phone?.includes(term)
    );
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      phone: "",
      lineId: "",
      device: "",
    });
    setEditingCustomer(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      phone: customer.phone || "",
      lineId: customer.lineId || customer.lineIdRes || "",
      device: customer.device || "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!form.firstName.trim()) {
      toast.error(
        language === "th" ? "กรุณากรอกชื่อ" : "Please enter first name"
      );
      return;
    }

    if (!form.lastName.trim()) {
      toast.error(
        language === "th"
          ? "กรุณากรอกนามสกุล"
          : "Please enter last name"
      );
      return;
    }

    try {
      if (editingCustomer) {
        const response = await apiClient.updateCustomer(editingCustomer.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || null,
          lineId: form.lineId.trim() || null,
          device: form.device.trim() || null,
        });

        if (response.status === "success") {
          toast.success(
            language === "th"
              ? "แก้ไขข้อมูลลูกค้าสำเร็จ"
              : "Customer updated successfully"
          );
          setIsDialogOpen(false);
          resetForm();
          loadCustomers();
        } else {
          toast.error(
            response.message ||
              (language === "th"
                ? "ไม่สามารถแก้ไขข้อมูลลูกค้าได้"
                : "Failed to update customer")
          );
        }
      } else {
        const response = await apiClient.createCustomer({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || null,
          lineId: form.lineId.trim() || null,
          device: form.device.trim() || null,
        });

        if (response.status === "success") {
          toast.success(
            language === "th"
              ? "เพิ่มลูกค้าสำเร็จ"
              : "Customer created successfully"
          );
          setIsDialogOpen(false);
          resetForm();
          loadCustomers();
        } else {
          toast.error(
            response.message ||
              (language === "th"
                ? "ไม่สามารถเพิ่มลูกค้าได้"
                : "Failed to create customer")
          );
        }
      }
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error(
        error?.response?.data?.message ||
          (language === "th"
            ? "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
            : "Error saving customer")
      );
    }
  };

  const openDeleteDialog = async (customer: Customer) => {
    setDeleteTarget(customer);
    setIsLoadingRepairsCount(true);
    setIsDeleteDialogOpen(true);
    
    // ดึงข้อมูลจำนวน repairs ที่เกี่ยวข้อง
    try {
      const response = await apiClient.getCustomerWithRepairs(customer.id);
      if (response.status === "success" && response.data?.repairs) {
        setRepairsCount(response.data.repairs.length || 0);
      } else {
        setRepairsCount(0);
      }
    } catch (error) {
      console.error("Error loading repairs count:", error);
      setRepairsCount(0);
    } finally {
      setIsLoadingRepairsCount(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;

    try {
      const response = await apiClient.deleteCustomer(deleteTarget.id);

      if (response.status === "success") {
        const deletedCounts = (response as any).deletedCounts;
        toast.success(
          language === "th"
            ? `ลบลูกค้าและข้อมูลที่เกี่ยวข้องสำเร็จ${deletedCounts?.repairs ? ` (ลบรายการซ่อม ${deletedCounts.repairs} รายการ)` : ""}`
            : `Customer and related data deleted successfully${deletedCounts?.repairs ? ` (${deletedCounts.repairs} repairs deleted)` : ""}`
        );
        setIsDeleteDialogOpen(false);
        setDeleteTarget(null);
        setRepairsCount(0);
        loadCustomers();
      } else {
        toast.error(
          response.message ||
            (language === "th"
              ? "ไม่สามารถลบลูกค้าได้"
              : "Failed to delete customer")
        );
      }
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast.error(
        error?.response?.data?.message ||
          (language === "th"
            ? "เกิดข้อผิดพลาดในการลบข้อมูล"
            : "Error deleting customer")
      );
    }
  };



  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <Users className="w-8 h-8" />
                {language === "th" ? "จัดการลูกค้า" : "Customer Management"}
              </h1>
              <p className="page-description">
                {language === "th"
                  ? "ดูและจัดการข้อมูลลูกค้าทั้งหมด"
                  : "View and manage all customer information"}
              </p>
            </div>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              {language === "th" ? "เพิ่มลูกค้า" : "Add Customer"}
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                language === "th"
                  ? "ค้นหาด้วยชื่อหรือเบอร์โทรศัพท์..."
                  : "Search by name or phone..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Customer Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "th" ? "ลูกค้าทั้งหมด" : "Total Customers"}
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {customers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "th" ? "มีเบอร์โทร" : "With Phone"}
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {customers.filter((c) => c.phone).length}
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "th" ? "มี LINE" : "With LINE"}
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {customers.filter((c) => c.lineId || c.lineIdRes).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List - Desktop & Mobile */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              {language === "th" ? "กำลังโหลด..." : "Loading..."}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {language === "th"
                  ? "ไม่พบข้อมูลลูกค้า"
                  : "No customers found"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {language === "th" ? "ชื่อ-นามสกุล" : "Name"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "เบอร์โทรศัพท์" : "Phone"}
                      </TableHead>
                      <TableHead>{language === "th" ? "LINE ID" : "LINE ID"}</TableHead>
                      <TableHead>
                        {language === "th" ? "วันที่สร้าง" : "Created At"}
                      </TableHead>
                      <TableHead className="text-right">
                        {language === "th" ? "จัดการ" : "Actions"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => {
                      const fullName =
                        customer.fullName ||
                        `${customer.firstName} ${customer.lastName || ""}`.trim();
                      return (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {fullName || customer.firstName}
                          </TableCell>
                          <TableCell>
                            {customer.phone || (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {customer.lineId ? (
                              <span className="text-blue-600 dark:text-blue-400">
                                {customer.lineId}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(customer.createdAt).toLocaleDateString(
                              language === "th" ? "th-TH" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  navigate(`/customers/${customer.id}`)
                                }
                                className="h-8 w-8"
                                title={
                                  language === "th"
                                    ? "ดูรายละเอียด"
                                    : "View Details"
                                }
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(customer)}
                                className="h-8 w-8"
                                title={
                                  language === "th" ? "แก้ไข" : "Edit"
                                }
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(customer)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title={language === "th" ? "ลบ" : "Delete"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border">
                {paginatedCustomers.map((customer) => {
                  const fullName =
                    customer.fullName ||
                    `${customer.firstName} ${customer.lastName || ""}`.trim();
                  return (
                    <div key={customer.id} className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{fullName || customer.firstName}</p>
                          {customer.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-sm">
                        {customer.lineId && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground min-w-[80px]">LINE ID:</span>
                            <span className="text-blue-600 dark:text-blue-400 break-all">{customer.lineId}</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <span className="text-muted-foreground min-w-[80px]">{language === "th" ? "วันที่สร้าง" : "Created"}:</span>
                          <span className="text-foreground">
                            {new Date(customer.createdAt).toLocaleDateString(
                              language === "th" ? "th-TH" : "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="flex-1 gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          {language === "th" ? "ดู" : "View"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                          className="flex-1 gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          {language === "th" ? "แก้ไข" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(customer)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-border p-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => {
                            if (currentPage > 1) {
                              setCurrentPage(currentPage - 1);
                            }
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
                            if (currentPage < totalPages) {
                              setCurrentPage(currentPage + 1);
                            }
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
                </div>
              )}

              {/* Summary */}
              <div className="p-4 border-t border-border bg-muted/30">
                <p className="text-sm text-muted-foreground text-center">
                  {language === "th"
                    ? `พบทั้งหมด ${filteredCustomers.length} รายการ (หน้า ${currentPage} จาก ${totalPages})`
                    : `Total ${filteredCustomers.length} customers (Page ${currentPage} of ${totalPages})`}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Customer Dialog */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetForm();
            }
            setIsDialogOpen(open);
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer
                  ? language === "th"
                    ? "แก้ไขข้อมูลลูกค้า"
                    : "Edit Customer"
                  : language === "th"
                  ? "เพิ่มลูกค้าใหม่"
                  : "Add New Customer"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {editingCustomer
                  ? language === "th"
                    ? "แก้ไขข้อมูลลูกค้า"
                    : "Edit customer information"
                  : language === "th"
                  ? "กรอกข้อมูลลูกค้าใหม่"
                  : "Enter new customer information"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName" className="text-sm">
                  {language === "th" ? "ชื่อ" : "First Name"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder={
                    language === "th" ? "กรอกชื่อ" : "Enter first name"
                  }
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName" className="text-sm">
                  {language === "th" ? "นามสกุล" : "Last Name"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder={
                    language === "th" ? "กรอกนามสกุล" : "Enter last name"
                  }
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-sm">
                  {language === "th" ? "เบอร์โทรศัพท์" : "Phone"}
                </Label>
                <Input
                  id="phone"
                  placeholder={
                    language === "th"
                      ? "กรอกเบอร์โทรศัพท์ (9-10 หลัก)"
                      : "Enter phone (9-10 digits)"
                  }
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lineId" className="text-sm">{language === "th" ? "UserLineID" : "UserLineID"}</Label>
                <Input
                  id="lineId"
                  placeholder={
                    language === "th" ? "กรอก UserLineID" : "Enter UserLineID"
                  }
                  value={form.lineId}
                  onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device" className="text-sm">
                  {language === "th" ? "เครื่อง (ยี่ห้อ/รุ่น)" : "Device (Brand/Model)"}
                </Label>
                <Input
                  id="device"
                  placeholder={
                    language === "th" ? "เช่น iPhone 15, Samsung S24" : "e.g. iPhone 15, Samsung S24"
                  }
                  value={form.device}
                  onChange={(e) => setForm({ ...form, device: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                className="w-full sm:w-auto"
              >
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </Button>
              <Button onClick={handleSaveCustomer} className="w-full sm:w-auto">
                {editingCustomer
                  ? language === "th"
                    ? "บันทึก"
                    : "Save"
                  : language === "th"
                  ? "เพิ่ม"
                  : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent className="w-[95vw] sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === "th" ? "ยืนยันการลบ" : "Confirm Delete"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm space-y-2">
                {language === "th" ? (
                  <>
                    <p>
                      คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้า{" "}
                      <strong>
                        {deleteTarget
                          ? deleteTarget.fullName ||
                            `${deleteTarget.firstName} ${deleteTarget.lastName || ""}`.trim()
                          : ""}
                      </strong>
                      ?
                    </p>
                    {isLoadingRepairsCount ? (
                      <p className="text-muted-foreground">กำลังตรวจสอบข้อมูล...</p>
                    ) : repairsCount > 0 ? (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                        <p className="font-semibold text-destructive">
                          ⚠️ คำเตือน: การลบนี้จะลบข้อมูลที่เกี่ยวข้องทั้งหมด
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                          <li>รายการซ่อมทั้งหมด: <strong>{repairsCount} รายการ</strong></li>
                          <li>บิลที่เกี่ยวข้องทั้งหมด</li>
                          <li>การรับประกันที่เกี่ยวข้องทั้งหมด</li>
                          <li>ธุรกรรมที่เกี่ยวข้องทั้งหมด</li>
                        </ul>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        การกระทำนี้ไม่สามารถยกเลิกได้
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      Are you sure you want to delete customer{" "}
                      <strong>
                        {deleteTarget
                          ? deleteTarget.fullName ||
                            `${deleteTarget.firstName} ${deleteTarget.lastName || ""}`.trim()
                          : ""}
                      </strong>
                      ?
                    </p>
                    {isLoadingRepairsCount ? (
                      <p className="text-muted-foreground">Checking related data...</p>
                    ) : repairsCount > 0 ? (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                        <p className="font-semibold text-destructive">
                          ⚠️ Warning: This will delete all related data
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                          <li>All repair orders: <strong>{repairsCount} items</strong></li>
                          <li>All related bills</li>
                          <li>All related warranty claims</li>
                          <li>All related transactions</li>
                        </ul>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        This action cannot be undone.
                      </p>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCustomer}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
              >
                {language === "th" ? "ลบ" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default Customers;
