/**
 * หน้าดูข้อมูลลูกค้า
 * ให้เลือกลูกค้าแล้วแสดงใบแจ้งซ่อมทั้งหมดของลูกค้านั้นๆ
 */
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs, type RepairItem } from "@/contexts/RepairsContext";
import { getRepairStatusDisplayLabel } from "@/lib/repairStatus";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { repairItemToBillData } from "@/types/repairOrder";
import { ArrowLeft, FileText, Eye, Search, User, Receipt } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const CustomerBills = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { repairs } = useRepairs();
  const { toast } = useToast();
  
  // Customer search state
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  // Customer bills state
  const [customerBills, setCustomerBills] = useState<RepairItem[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

  // Search customers
  const handleSearchCustomers = async (query: string) => {
    setIsSearching(true);
    try {
      const searchQuery = query.trim();
      const response = await apiClient.searchCustomers(searchQuery);
      if (response.status === 'success' && response.data) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  useEffect(() => {
    if (isSearchDialogOpen) {
      const timeoutId = setTimeout(() => {
        if (searchQuery.trim().length >= 2 || searchQuery.trim().length === 0) {
          handleSearchCustomers(searchQuery);
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, isSearchDialogOpen]);

  // Select customer and load their bills
  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsSearchDialogOpen(false);
    setSearchQuery("");
    
    // Load customer's repair bills
    setIsLoadingBills(true);
    try {
      // Filter repairs by customer phone or name
      const customerPhone = customer.phone;
      const customerName = customer.fullName || `${customer.firstName} ${customer.lastName || ''}`.trim();
      
      const customerRepairs = repairs.filter((repair) => {
        const repairPhone = repair.phone?.toLowerCase() || "";
        const repairCustomer = repair.customer?.toLowerCase() || "";
        return (
          repairPhone.includes(customerPhone?.toLowerCase() || "") ||
          repairCustomer.includes(customerName.toLowerCase())
        );
      });
      
      setCustomerBills(customerRepairs);
      
      if (customerRepairs.length === 0) {
        toast({
          title: language === "th" ? "ไม่พบบิล" : "No Bills Found",
          description: language === "th" 
            ? "ลูกค้านี้ยังไม่มีบิลในระบบ" 
            : "This customer has no bills in the system",
        });
      }
    } catch (error) {
      console.error('Error loading customer bills:', error);
      toast({
        title: language === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: language === "th" 
          ? "ไม่สามารถโหลดบิลของลูกค้าได้" 
          : "Failed to load customer bills",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBills(false);
    }
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

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    setCustomerBills([]);
    setSearchQuery("");
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">
              {language === "th" ? "ดูข้อมูลลูกค้า" : "Customer Info"}
            </h1>
            <p className="page-description">
              {language === "th"
                ? "เลือกลูกค้าเพื่อดูข้อมูลทั้งหมดของลูกค้า"
                : "Select a customer to view all their information"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/repairs")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {language === "th" ? "กลับ" : "Back"}
            </Button>
          </div>
        </div>

        {/* Customer Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {language === "th" ? "เลือกลูกค้า" : "Select Customer"}
            </CardTitle>
            <CardDescription>
              {language === "th"
                ? "คลิกปุ่มค้นหาเพื่อเลือกลูกค้าที่ต้องการดูข้อมูล"
                : "Click search to select a customer to view their information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCustomer ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                  <div>
                    <p className="font-semibold text-lg">
                      {selectedCustomer.fullName || 
                       `${selectedCustomer.firstName} ${selectedCustomer.lastName || ''}`.trim()}
                    </p>
                    {selectedCustomer.phone && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === "th" ? "เบอร์โทร" : "Phone"}: {selectedCustomer.phone}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleClearSelection}>
                    {language === "th" ? "เปลี่ยนลูกค้า" : "Change Customer"}
                  </Button>
                </div>
                
                {isLoadingBills ? (
                  <p className="text-center text-muted-foreground py-8">
                    {language === "th" ? "กำลังโหลดบิล..." : "Loading bills..."}
                  </p>
                ) : customerBills.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {language === "th" 
                        ? `พบ ${customerBills.length} บิล` 
                        : `Found ${customerBills.length} bill(s)`}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left p-3 font-medium">{t("orderId")}</th>
                            <th className="text-left p-3 font-medium">{t("device")}</th>
                            <th className="text-left p-3 font-medium">{t("issue")}</th>
                            <th className="text-right p-3 font-medium">{t("estCost")}</th>
                            <th className="text-center p-3 font-medium">
                              {language === "th" ? "สถานะ" : "Status"}
                            </th>
                            <th className="text-center p-3 font-medium w-32">
                              {language === "th" ? "จัดการ" : "Actions"}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerBills.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-border last:border-0 hover:bg-muted/30"
                            >
                              <td className="p-3 font-mono text-muted-foreground">{item.id}</td>
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
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    item.status === "completed" || item.status === "picked-up"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : item.status === "in-progress"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      : item.status === "pending"
                                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                  }`}
                                >
                                  {getRepairStatusDisplayLabel(item.status as any, language)}
                                </span>
                              </td>
                               <td className="p-3">
                                 <div className="flex items-center justify-center gap-2">
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     className="gap-1"
                                     onClick={() => handleViewBill(item)}
                                   >
                                     <Eye className="w-3.5 h-3.5" />
                                     {language === "th" ? "ดูใบแจ้งซ่อม" : "View Bill"}
                                   </Button>
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     className="gap-1"
                                     onClick={() => handleViewReceipt(item)}
                                   >
                                     <Receipt className="w-3.5 h-3.5" />
                                     {language === "th" ? "ดูใบเสร็จ" : "View Receipt"}
                                   </Button>
                                 </div>
                               </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {language === "th" 
                      ? "ลูกค้านี้ยังไม่มีบิลในระบบ" 
                      : "This customer has no bills in the system"}
                  </p>
                )}
              </div>
            ) : (
              <Button
                onClick={() => setIsSearchDialogOpen(true)}
                className="w-full gap-2"
                size="lg"
              >
                <Search className="w-4 h-4" />
                {language === "th" ? "ค้นหาลูกค้า" : "Search Customer"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Customer Search Dialog */}
        <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === "th" ? "ค้นหาลูกค้า" : "Search Customer"}
              </DialogTitle>
              <DialogDescription>
                {language === "th"
                  ? "ค้นหาด้วยชื่อหรือเบอร์โทรศัพท์"
                  : "Search by name or phone number"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={language === "th" ? "ค้นหาชื่อหรือเบอร์โทร..." : "Search name or phone..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isSearching ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === "th" ? "กำลังค้นหา..." : "Searching..."}
                </p>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <p className="font-medium">
                        {customer.fullName || 
                         `${customer.firstName} ${customer.lastName || ''}`.trim()}
                      </p>
                      {customer.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {language === "th" ? "เบอร์โทร" : "Phone"}: {customer.phone}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === "th" ? "ไม่พบลูกค้า" : "No customers found"}
                </p>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  {language === "th" 
                    ? "กรุณาพิมพ์ชื่อหรือเบอร์โทรศัพท์เพื่อค้นหา" 
                    : "Please type name or phone number to search"}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsSearchDialogOpen(false)}>
                {language === "th" ? "ปิด" : "Close"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default CustomerBills;
