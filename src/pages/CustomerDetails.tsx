import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useSocket } from "@/contexts/SocketContext";
import { apiClient } from "@/lib/api";
import { getRepairStatusDisplayLabel } from "@/lib/repairStatus";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Mail,
  MessageSquare,
  Phone,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface Customer {
  id: string;
  firstName: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  lineId?: string;
  lineIdRes?: string;
  createdAt: string;
  updatedAt: string;
  repairs?: Repair[];
}

interface Repair {
  id: string;
  repairNumber: string;
  deviceModel?: string;
  deviceType?: string;
  serialNumber?: string;
  problemDescription?: string;
  problemSymptoms?: string;
  status: string;
  estimatedPrice?: number;
  totalCost?: number;
  createdAt: string;
  dateOfReport?: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  "in-progress": <Wrench className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const CustomerDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    lineId: "",
  });

  const loadCustomerDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await apiClient.getCustomerWithRepairs(id);
      if (response.status === "success" && response.data) {
        setCustomer(response.data);
      } else {
        toast.error(
          response.message ||
            (language === "th"
              ? "ไม่สามารถโหลดข้อมูลลูกค้าได้"
              : "Failed to load customer data")
        );
        navigate("/customers");
      }
    } catch (error) {
      console.error("Error loading customer:", error);
      toast.error(
        language === "th"
          ? "เกิดข้อผิดพลาดในการโหลดข้อมูล"
          : "Error loading customer data"
      );
      navigate("/customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerDetails();
  }, [id]);

  // Real-time updates
  useEffect(() => {
    if (!socket || !isConnected || !customer) return;

    const handleRepairUpdate = (repair: any) => {
      // Check if this repair belongs to current customer
      if (repair.customer?.id === customer.id) {
        loadCustomerDetails();
      }
    };

    socket.on("repair:created", handleRepairUpdate);
    socket.on("repair:updated", handleRepairUpdate);
    socket.on("repair:deleted", loadCustomerDetails);

    return () => {
      socket.off("repair:created", handleRepairUpdate);
      socket.off("repair:updated", handleRepairUpdate);
      socket.off("repair:deleted", loadCustomerDetails);
    };
  }, [socket, isConnected, customer]);

  const openEditDialog = () => {
    if (!customer) return;
    setForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      phone: customer.phone || "",
      lineId: customer.lineId || customer.lineIdRes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customer) return;

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
      const response = await apiClient.updateCustomer(customer.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        lineId: form.lineId.trim() || null,
      });

      if (response.status === "success") {
        toast.success(
          language === "th"
            ? "แก้ไขข้อมูลลูกค้าสำเร็จ"
            : "Customer updated successfully"
        );
        setIsEditDialogOpen(false);
        loadCustomerDetails();
      } else {
        toast.error(
          response.message ||
            (language === "th"
              ? "ไม่สามารถแก้ไขข้อมูลลูกค้าได้"
              : "Failed to update customer")
        );
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

  const getStatusLabel = (status: string) => {
    return getRepairStatusDisplayLabel(status as any, language);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {language === "th" ? "กำลังโหลด..." : "Loading..."}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!customer) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === "th" ? "ไม่พบข้อมูลลูกค้า" : "Customer not found"}
          </p>
        </div>
      </MainLayout>
    );
  }

  const fullName =
    customer.fullName ||
    `${customer.firstName} ${customer.lastName || ""}`.trim();

  const totalRepairs = customer.repairs?.length || 0;
  const completedRepairs =
    customer.repairs?.filter((r) => r.status === "completed").length || 0;
  const activeRepairs =
    customer.repairs?.filter(
      (r) => r.status === "pending" || r.status === "in-progress"
    ).length || 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/customers">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {fullName}
              </h1>
              <p className="text-muted-foreground mt-1">
                {language === "th"
                  ? "ข้อมูลลูกค้าและประวัติการซ่อม"
                  : "Customer information and repair history"}
              </p>
            </div>
          </div>
          <Button onClick={openEditDialog} className="gap-2">
            <Edit className="w-4 h-4" />
            {language === "th" ? "แก้ไขข้อมูล" : "Edit Information"}
          </Button>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {language === "th" ? "ข้อมูลลูกค้า" : "Customer Information"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === "th" ? "ชื่อ-นามสกุล" : "Full Name"}
                    </p>
                    <p className="font-medium">{fullName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === "th" ? "เบอร์โทรศัพท์" : "Phone Number"}
                    </p>
                    <p className="font-medium">
                      {customer.phone || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">{language === "th" ? "UserLineID" : "UserLineID"}</p>
                    <p className="font-medium">
                      {customer.lineIdRes || customer.lineId ? (
                        <span className="text-green-600 dark:text-green-400">
                          {customer.lineIdRes || customer.lineId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === "th" ? "วันที่สร้าง" : "Created Date"}
                    </p>
                    <p className="font-medium">
                      {new Date(customer.createdAt).toLocaleDateString(
                        language === "th" ? "th-TH" : "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Wrench className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "งานซ่อมทั้งหมด" : "Total Repairs"}
                  </p>
                  <p className="text-2xl font-semibold">{totalRepairs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "งานเสร็จสิ้น" : "Completed"}
                  </p>
                  <p className="text-2xl font-semibold">{completedRepairs}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "กำลังดำเนินการ" : "Active"}
                  </p>
                  <p className="text-2xl font-semibold">{activeRepairs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Repair History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              {language === "th" ? "ประวัติการซ่อม" : "Repair History"}
            </CardTitle>
            <CardDescription>
              {language === "th"
                ? "รายการงานซ่อมทั้งหมดของลูกค้า"
                : "All repair records for this customer"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!customer.repairs || customer.repairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>
                  {language === "th"
                    ? "ยังไม่มีประวัติการซ่อม"
                    : "No repair history yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {language === "th" ? "หมายเลขงาน" : "Repair #"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "อุปกรณ์" : "Device"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "Serial Number" : "Serial #"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "อาการ" : "Problem"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "สถานะ" : "Status"}
                      </TableHead>
                      <TableHead>
                        {language === "th" ? "วันที่" : "Date"}
                      </TableHead>
                      <TableHead className="text-right">
                        {language === "th" ? "ราคา" : "Price"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.repairs.map((repair) => (
                      <TableRow key={repair.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/repairs?search=${repair.repairNumber}`}
                            className="text-primary hover:underline"
                          >
                            {repair.repairNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {repair.deviceModel || repair.deviceType || "-"}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {repair.serialNumber || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {language === "th"
                            ? repair.problemSymptoms || repair.problemDescription
                            : repair.problemDescription || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              statusStyles[repair.status] || ""
                            }`}
                          >
                            {statusIcons[repair.status]}
                            {getStatusLabel(repair.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(
                            repair.dateOfReport || repair.createdAt
                          ).toLocaleDateString(
                            language === "th" ? "th-TH" : "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ฿
                          {(
                            repair.totalCost ||
                            repair.estimatedPrice ||
                            0
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === "th"
                  ? "แก้ไขข้อมูลลูกค้า"
                  : "Edit Customer Information"}
              </DialogTitle>
              <DialogDescription>
                {language === "th"
                  ? "แก้ไขข้อมูลของลูกค้า"
                  : "Update customer information"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">
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
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">
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
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">
                  {language === "th" ? "เบอร์โทรศัพท์" : "Phone Number"}
                </Label>
                <Input
                  id="phone"
                  placeholder={
                    language === "th"
                      ? "กรอกเบอร์โทรศัพท์"
                      : "Enter phone number"
                  }
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lineId">{language === "th" ? "UserLineID" : "UserLineID"}</Label>
                <Input
                  id="lineId"
                  placeholder={
                    language === "th" ? "กรอก UserLineID" : "Enter UserLineID"
                  }
                  value={form.lineId}
                  onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </Button>
              <Button onClick={handleSaveCustomer}>
                {language === "th" ? "บันทึก" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default CustomerDetails;
