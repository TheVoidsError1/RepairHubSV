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
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api";
import { ArrowLeft, Edit, Plus, Search, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

const CustomerManagement = () => {
  const { language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [repairsCount, setRepairsCount] = useState<number>(0);
  const [isLoadingRepairsCount, setIsLoadingRepairsCount] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    lineId: "",
    device: "",
  });

  // โหลดข้อมูลลูกค้า
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

  // ค้นหาลูกค้า
  const searchCustomers = async () => {
    if (!searchTerm.trim()) {
      loadCustomers();
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.searchCustomers(searchTerm);
      if (response.status === "success" && response.data) {
        setCustomers(response.data);
      } else {
        toast.error(
          response.message ||
            (language === "th"
              ? "ไม่สามารถค้นหาลูกค้าได้"
              : "Failed to search customers")
        );
      }
    } catch (error) {
      console.error("Error searching customers:", error);
      toast.error(
        language === "th"
          ? "เกิดข้อผิดพลาดในการค้นหา"
          : "Error searching customers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // กรองข้อมูลตาม searchTerm (client-side filtering)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchCustomers();
  };

  // Reset form
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

  // เปิด Dialog สำหรับเพิ่มลูกค้า
  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // เปิด Dialog สำหรับแก้ไขลูกค้า
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

  // บันทึกลูกค้า (เพิ่มหรือแก้ไข)
  const handleSaveCustomer = async () => {
    // Validation
    if (!form.firstName.trim()) {
      toast.error(
        language === "th"
          ? "กรุณากรอกชื่อ"
          : "Please enter first name"
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

    // Validate phone if provided
    if (form.phone && !/^[0-9]{9,10}$/.test(form.phone.replace(/[-\s]/g, ""))) {
      toast.error(
        language === "th"
          ? "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก"
          : "Phone number must be 9-10 digits"
      );
      return;
    }

    try {
      if (editingCustomer) {
        // Update customer
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
        // Create customer
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

  // เปิด Dialog สำหรับลบลูกค้า
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

  // ลบลูกค้า
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
        if (response.message?.includes("repairs")) {
          toast.info(
            language === "th"
              ? "ไม่สามารถลบลูกค้าที่มีรายการซ่อมได้ กรุณาลบหรือย้ายรายการซ่อมก่อน"
              : "Cannot delete customer with existing repairs. Please delete or reassign repairs first."
          );
        }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/system">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {language === "th" ? "ดูข้อมูลลูกค้า" : "Customer Management"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {language === "th"
                  ? "ดูและค้นหาข้อมูลลูกค้าทั้งหมด"
                  : "View and search all customer information"}
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            {language === "th" ? "เพิ่มลูกค้า" : "Add Customer"}
          </Button>
        </div>

        {/* Search Bar */}
        <div className="bg-card rounded-xl border border-border p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  language === "th"
                    ? "ค้นหาด้วยชื่อหรือเบอร์โทรศัพท์..."
                    : "Search by name or phone..."
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!e.target.value.trim()) {
                    loadCustomers();
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="default">
              {language === "th" ? "ค้นหา" : "Search"}
            </Button>
            {searchTerm && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  loadCustomers();
                }}
              >
                {language === "th" ? "ล้าง" : "Clear"}
              </Button>
            )}
          </form>
        </div>

        {/* Customer List */}
        <div className="bg-card rounded-xl border border-border">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {language === "th" ? "ชื่อ-นามสกุล" : "Name"}
                    </TableHead>
                    <TableHead>
                      {language === "th" ? "เบอร์โทรศัพท์" : "Phone"}
                    </TableHead>
                    <TableHead>
                      {language === "th" ? "UserLineID" : "UserLineID"}
                    </TableHead>
                    <TableHead>
                      {language === "th" ? "วันที่สร้าง" : "Created At"}
                    </TableHead>
                    <TableHead className="text-right">
                      {language === "th" ? "จัดการ" : "Actions"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
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
                            <span className="text-muted-foreground">
                              {language === "th" ? "-" : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.lineIdRes || customer.lineId ? (
                            <span className="text-green-600 dark:text-green-400">
                              {customer.lineIdRes || customer.lineId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {language === "th" ? "-" : "-"}
                            </span>
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
                              onClick={() => openEditDialog(customer)}
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(customer)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
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
          )}

          {/* Summary */}
          {!loading && filteredCustomers.length > 0 && (
            <div className="p-4 border-t border-border bg-muted/30">
              <p className="text-sm text-muted-foreground text-center">
                {language === "th"
                  ? `พบทั้งหมด ${filteredCustomers.length} รายการ`
                  : `Total ${filteredCustomers.length} customers`}
              </p>
            </div>
          )}
        </div>

        {/* Add/Edit Customer Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
          setIsDialogOpen(open);
        }}>
          <DialogContent>
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
              <DialogDescription>
                {editingCustomer
                  ? language === "th"
                    ? "แก้ไขข้อมูลลูกค้า"
                    : "Edit customer information"
                  : language === "th"
                  ? "กรอกข้อมูลลูกค้าใหม่"
                  : "Enter new customer information"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">
                  {language === "th" ? "ชื่อ" : "First Name"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder={language === "th" ? "กรอกชื่อ" : "Enter first name"}
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">
                  {language === "th" ? "นามสกุล" : "Last Name"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder={language === "th" ? "กรอกนามสกุล" : "Enter last name"}
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">
                  {language === "th" ? "เบอร์โทรศัพท์" : "Phone"}
                </Label>
                <Input
                  id="phone"
                  placeholder={language === "th" ? "กรอกเบอร์โทรศัพท์ (9-10 หลัก)" : "Enter phone (9-10 digits)"}
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lineId">
                  {language === "th" ? "UserLineID" : "UserLineID"}
                </Label>
                <Input
                  id="lineId"
                  placeholder={language === "th" ? "กรอก UserLineID" : "Enter UserLineID"}
                  value={form.lineId}
                  onChange={(e) =>
                    setForm({ ...form, lineId: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="device">
                  {language === "th" ? "เครื่อง (ยี่ห้อ/รุ่น)" : "Device (Brand/Model)"}
                </Label>
                <Input
                  id="device"
                  placeholder={language === "th" ? "เช่น iPhone 15, Samsung S24" : "e.g. iPhone 15, Samsung S24"}
                  value={form.device}
                  onChange={(e) =>
                    setForm({ ...form, device: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </Button>
              <Button onClick={handleSaveCustomer}>
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
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
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
            <AlertDialogFooter>
              <AlertDialogCancel>
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCustomer}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

export default CustomerManagement;
