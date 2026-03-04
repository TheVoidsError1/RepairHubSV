import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api";
import {
  FileText,
  Edit,
  RotateCcw,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface StatusTemplate {
  status: string;
  template: string;
  description: string;
}

// สร้าง STATUS_LABELS จาก templates ที่ดึงมา (จะอัพเดทเมื่อ fetch templates)
const getStatusLabels = (templates: Record<string, StatusTemplate>): Record<string, { th: string; en: string }> => {
  const labels: Record<string, { th: string; en: string }> = {
    pending: { th: "รอดำเนินการ", en: "Pending" },
    "in-progress": { th: "กำลังซ่อม", en: "In Progress" },
    waiting_parts: { th: "รออะไหล่", en: "Waiting Parts" },
    completed: { th: "ซ่อมเสร็จแล้ว", en: "Completed" },
    cancelled: { th: "ยกเลิกแล้ว", en: "Cancelled" },
    "picked-up": { th: "รับเครื่องแล้ว", en: "Picked Up" },
    scheduled_pickup: { th: "นัดรับ", en: "Scheduled Pickup" },
  };
  
  // เพิ่มสถานะจาก templates ที่ดึงมา (ถ้ามีสถานะใหม่ที่ยังไม่มีใน labels)
  Object.keys(templates).forEach(status => {
    if (!labels[status]) {
      // สร้าง label จาก status key
      const statusKey = status.replace(/_/g, ' ').replace(/-/g, ' ');
      labels[status] = {
        th: statusKey,
        en: statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
      };
    }
  });
  
  return labels;
};

const LineTemplates = () => {
  const { language } = useLanguage();
  const isTh = language === "th";
  const [templates, setTemplates] = useState<Record<string, StatusTemplate>>({});
  const [statusLabels, setStatusLabels] = useState<Record<string, { th: string; en: string }>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [editingTemplate, setEditingTemplate] = useState<string>("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testUserId, setTestUserId] = useState("");
  const [testData, setTestData] = useState({
    customerName: "สมชาย ใจดี",
    repairNumber: "RP-2024-0001",
    deviceType: "iPhone 13 Pro",
    additionalInfo: "",
  });
  const [testing, setTesting] = useState(false);

  // ดึง template ทั้งหมด
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getLineStatusTemplates();
      if (response.status === "success" && response.data) {
        setTemplates(response.data);
        // สร้าง status labels จาก templates ที่ดึงมา
        const labels = getStatusLabels(response.data);
        setStatusLabels(labels);
        // ตั้งค่า template ที่เลือก
        if (response.data[selectedStatus]) {
          setEditingTemplate(response.data[selectedStatus].template);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error(isTh ? "ไม่สามารถโหลดเทมเพลตได้" : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // เมื่อเปลี่ยนสถานะที่เลือก
  useEffect(() => {
    if (templates[selectedStatus]) {
      setEditingTemplate(templates[selectedStatus].template);
    }
  }, [selectedStatus, templates]);

  // บันทึก template
  const handleSave = async () => {
    if (!editingTemplate.trim()) {
      toast.error(isTh ? "กรุณากรอกเทมเพลต" : "Please enter a template");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.updateLineStatusTemplate(
        selectedStatus,
        editingTemplate
      );
      if (response.status === "success") {
        toast.success(isTh ? "บันทึกเทมเพลตสำเร็จ" : "Template saved successfully");
        await fetchTemplates();
        setShowEditDialog(false);
      } else {
        toast.error(response.message || (isTh ? "ไม่สามารถบันทึกได้" : "Failed to save"));
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(isTh ? "เกิดข้อผิดพลาดในการบันทึก" : "Error saving template");
    } finally {
      setSaving(false);
    }
  };

  // รีเซ็ต template
  const handleReset = async (status?: string) => {
    setResetting(true);
    try {
      const response = await apiClient.resetLineStatusTemplate(status || selectedStatus);
      if (response.status === "success") {
        toast.success(
          isTh
            ? `รีเซ็ตเทมเพลต${status ? `สำหรับสถานะ ${statusLabels[status]?.th || status}` : "ทั้งหมด"}สำเร็จ`
            : `Template${status ? ` for ${statusLabels[status]?.en || status}` : "s"} reset successfully`
        );
        await fetchTemplates();
      } else {
        toast.error(response.message || (isTh ? "ไม่สามารถรีเซ็ตได้" : "Failed to reset"));
      }
    } catch (error) {
      console.error("Error resetting template:", error);
      toast.error(isTh ? "เกิดข้อผิดพลาดในการรีเซ็ต" : "Error resetting template");
    } finally {
      setResetting(false);
    }
  };

  // ทดสอบส่งข้อความ
  const handleTest = async () => {
    if (!testUserId.trim()) {
      toast.error(isTh ? "กรุณากรอก LINE User ID" : "Please enter LINE User ID");
      return;
    }

    if (!testUserId.startsWith("U")) {
      toast.error(
        isTh
          ? "LINE User ID ต้องขึ้นต้นด้วย 'U'"
          : "LINE User ID must start with 'U'"
      );
      return;
    }

    setTesting(true);
    try {
      const response = await apiClient.testLineTemplate(
        testUserId,
        selectedStatus,
        testData.customerName,
        testData.repairNumber,
        testData.deviceType,
        testData.additionalInfo || undefined
      );

      if (response.status === "success") {
        toast.success(isTh ? "ส่งข้อความทดสอบสำเร็จ" : "Test message sent successfully");
      } else {
        toast.error(response.message || (isTh ? "ไม่สามารถส่งข้อความได้" : "Failed to send message"));
      }
    } catch (error) {
      console.error("Error testing template:", error);
      toast.error(isTh ? "เกิดข้อผิดพลาดในการส่งข้อความ" : "Error sending test message");
    } finally {
      setTesting(false);
    }
  };

  // เปิด dialog แก้ไข
  const handleEdit = (status: string) => {
    setSelectedStatus(status);
    setEditingTemplate(templates[status]?.template || "");
    setShowEditDialog(true);
  };

  // แทนที่ตัวแปรใน template เพื่อแสดง preview
  const getPreview = (template: string) => {
    return template
      .replace(/{customerName}/g, testData.customerName)
      .replace(/{repairNumber}/g, testData.repairNumber)
      .replace(/{deviceType}/g, testData.deviceType)
      .replace(/{status}/g, statusLabels[selectedStatus]?.th || selectedStatus)
      .replace(
        /{additionalInfo}/g,
        testData.additionalInfo ? `หมายเหตุ: ${testData.additionalInfo}\n` : ""
      );
  };

  return (
    <MainLayout>
      <div className="page-header mb-8">
        <h1 className="page-title">
          {isTh ? "Template ข้อความ LINE" : "LINE Message Templates"}
        </h1>
        <p className="page-description">
          {isTh
            ? "จัดการเทมเพลตข้อความแจ้งเตือนสถานะการซ่อมที่ส่งไปยังลูกค้าผ่าน LINE"
            : "Manage repair status notification message templates sent to customers via LINE"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(templates).map(([status, template]) => {
              const label = statusLabels[status];
              return (
                <Card key={status} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {isTh ? label?.th : label?.en || status}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {isTh ? template.description : status}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(status)}
                        className="shrink-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground line-clamp-3">
                        {template.template.substring(0, 100)}
                        {template.template.length > 100 ? "..." : ""}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(status)}
                          className="flex-1"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          {isTh ? "แก้ไข" : "Edit"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReset(status)}
                          disabled={resetting}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Preview and Test Section */}
          <Card>
            <CardHeader>
              <CardTitle>{isTh ? "ตัวอย่างและทดสอบ" : "Preview & Test"}</CardTitle>
              <CardDescription>
                {isTh
                  ? "ดูตัวอย่างข้อความและทดสอบส่งข้อความ"
                  : "Preview message and test sending"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">
                    {isTh ? "ตัวอย่าง" : "Preview"}
                  </TabsTrigger>
                  <TabsTrigger value="test">
                    {isTh ? "ทดสอบ" : "Test"}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isTh ? "เลือกสถานะ" : "Select Status"}</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <SelectItem key={status} value={status}>
                            {isTh ? label.th : label.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isTh ? "ข้อมูลทดสอบ" : "Test Data"}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "ชื่อลูกค้า" : "Customer Name"}
                        </Label>
                        <input
                          type="text"
                          value={testData.customerName}
                          onChange={(e) =>
                            setTestData({ ...testData, customerName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "หมายเลขงานซ่อม" : "Repair Number"}
                        </Label>
                        <input
                          type="text"
                          value={testData.repairNumber}
                          onChange={(e) =>
                            setTestData({ ...testData, repairNumber: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "อุปกรณ์" : "Device Type"}
                        </Label>
                        <input
                          type="text"
                          value={testData.deviceType}
                          onChange={(e) =>
                            setTestData({ ...testData, deviceType: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "หมายเหตุ" : "Additional Info"}
                        </Label>
                        <input
                          type="text"
                          value={testData.additionalInfo}
                          onChange={(e) =>
                            setTestData({ ...testData, additionalInfo: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{isTh ? "ตัวอย่างข้อความ" : "Message Preview"}</Label>
                    <div className="p-4 bg-muted rounded-lg border whitespace-pre-wrap text-sm">
                      {templates[selectedStatus]
                        ? getPreview(templates[selectedStatus].template)
                        : isTh
                        ? "ไม่พบเทมเพลต"
                        : "Template not found"}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="test" className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      {isTh ? "LINE User ID" : "LINE User ID"} <span className="text-red-500">*</span>
                    </Label>
                    <input
                      type="text"
                      value={testUserId}
                      onChange={(e) => setTestUserId(e.target.value)}
                      placeholder="U1234567890abcdef..."
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      {isTh
                        ? "LINE User ID ต้องขึ้นต้นด้วย 'U'"
                        : "LINE User ID must start with 'U'"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{isTh ? "ข้อมูลทดสอบ" : "Test Data"}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "ชื่อลูกค้า" : "Customer Name"}
                        </Label>
                        <input
                          type="text"
                          value={testData.customerName}
                          onChange={(e) =>
                            setTestData({ ...testData, customerName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "หมายเลขงานซ่อม" : "Repair Number"}
                        </Label>
                        <input
                          type="text"
                          value={testData.repairNumber}
                          onChange={(e) =>
                            setTestData({ ...testData, repairNumber: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "อุปกรณ์" : "Device Type"}
                        </Label>
                        <input
                          type="text"
                          value={testData.deviceType}
                          onChange={(e) =>
                            setTestData({ ...testData, deviceType: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {isTh ? "หมายเหตุ" : "Additional Info"}
                        </Label>
                        <input
                          type="text"
                          value={testData.additionalInfo}
                          onChange={(e) =>
                            setTestData({ ...testData, additionalInfo: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm border rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleTest}
                    disabled={testing || !testUserId.trim()}
                    className="w-full"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isTh ? "กำลังส่ง..." : "Sending..."}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {isTh ? "ส่งข้อความทดสอบ" : "Send Test Message"}
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                {isTh ? "ตัวแปรที่ใช้ได้" : "Available Variables"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{customerName}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- ชื่อลูกค้า" : "- Customer name"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{repairNumber}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- หมายเลขงานซ่อม" : "- Repair number"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{deviceType}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- ประเภทอุปกรณ์" : "- Device type"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{status}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- สถานะการซ่อม" : "- Repair status"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{additionalInfo}"}
                  </code>
                  <span className="ml-2">
                    {isTh
                      ? "- ข้อมูลเพิ่มเติม (จะแสดงเป็น 'หมายเหตุ: ...' เมื่อมีข้อมูล)"
                      : "- Additional info (will show as 'Note: ...' when available)"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{receiveDate}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- วันที่รับเครื่อง" : "- Receive date"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{receiveTime}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- เวลารับเครื่อง" : "- Receive time"}
                  </span>
                </div>
                <div>
                  <code className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                    {"{scheduledPickupTime}"}
                  </code>
                  <span className="ml-2">
                    {isTh ? "- วันเวลานัดรับเครื่อง" : "- Scheduled pickup time"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isTh ? "แก้ไขเทมเพลต" : "Edit Template"} -{" "}
              {statusLabels[selectedStatus]
                ? isTh
                  ? statusLabels[selectedStatus].th
                  : statusLabels[selectedStatus].en
                : selectedStatus}
            </DialogTitle>
            <DialogDescription>
              {isTh
                ? "แก้ไขเทมเพลตข้อความสำหรับสถานะนี้"
                : "Edit message template for this status"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isTh ? "เทมเพลตข้อความ" : "Message Template"}</Label>
              <Textarea
                value={editingTemplate}
                onChange={(e) => setEditingTemplate(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder={isTh ? "กรอกเทมเพลตข้อความ..." : "Enter message template..."}
              />
            </div>
            <div className="space-y-2">
              <Label>{isTh ? "ตัวอย่างข้อความ" : "Preview"}</Label>
              <div className="p-4 bg-muted rounded-lg border whitespace-pre-wrap text-sm">
                {getPreview(editingTemplate)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
            >
              {isTh ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleReset(selectedStatus)}
              disabled={saving || resetting}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {isTh ? "รีเซ็ต" : "Reset"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isTh ? "กำลังบันทึก..." : "Saving..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isTh ? "บันทึก" : "Save"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default LineTemplates;
