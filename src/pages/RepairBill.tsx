/**
 * หน้ารายการออกบิล — เลือกงานซ่อมแล้วไปยัง ใบเสร็จรับเงิน (RepairReceipt)
 * แยกไฟล์ระหว่างใบแจ้งซ่อมกับใบเสร็จรับเงินเพื่อให้ตรวจเช็คและแก้ไขง่าย
 */
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs, type RepairItem } from "@/contexts/RepairsContext";
import { getRepairStatusLabel } from "@/lib/repairStatus";
import { cn } from "@/lib/utils";
import { repairItemToBillData } from "@/types/repairOrder";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileText, Receipt, Search, Filter } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const RepairBill = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { repairs } = useRepairs();
  const highlightRepairId = (location.state as { highlightRepairId?: string } | null)?.highlightRepairId;
  
  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "price-high" | "price-low" | "customer">("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;
  
  // Filter and sort repairs
  const filteredAndSortedRepairs = useMemo(() => {
    let filtered = repairs.filter((repair) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          repair.customer.toLowerCase().includes(query) ||
          repair.id.toLowerCase().includes(query) ||
          repair.device.toLowerCase().includes(query) ||
          repair.phone?.toLowerCase().includes(query) ||
          (repair.issueTh && repair.issueTh.toLowerCase().includes(query)) ||
          (repair.issue && repair.issue.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== "all" && repair.status !== statusFilter) {
        return false;
      }
      
      return true;
    });
    
    // Sort repairs
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          // Sort by createdAt descending (newest first)
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        case "oldest":
          // Sort by createdAt ascending (oldest first)
          const dateAOld = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateBOld = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateAOld - dateBOld;
        case "price-high":
          return b.estimatedCost - a.estimatedCost;
        case "price-low":
          return a.estimatedCost - b.estimatedCost;
        case "customer":
          return a.customer.localeCompare(b.customer, language === "th" ? "th" : "en");
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [repairs, searchQuery, sortBy, statusFilter, language]);
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedRepairs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRepairs = filteredAndSortedRepairs.slice(startIndex, endIndex);
  
  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, statusFilter]);

  const handleIssueReceipt = (item: RepairItem) => {
    const orderData = repairItemToBillData(item, language);
    navigate("/repairs/bill/receipt", { 
      state: { 
        ...orderData, 
        repairId: item.id,
        selectedPart: item.selectedPart, // backward compatibility
        selectedParts: item.selectedParts || (item.selectedPart ? [item.selectedPart] : undefined),
        additionalParts: item.additionalParts || undefined,
      } 
    });
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">{t("repairBill")}</h1>
            <p className="page-description">
              {language === "th"
                ? "เลือกงานซ่อมจากรายการด้านล่างเพื่อออกใบเสร็จรับเงิน"
                : "Select a repair from the list below to issue a receipt."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/repairs")} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t("backToRepairs")}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  {language === "th" ? "รายการงานซ่อม" : "Repair list"}
                </CardTitle>
                <CardDescription>
                  {language === "th"
                    ? "กดปุ่มออกใบเสร็จที่แถวที่ต้องการ"
                    : "Click Issue receipt on a row."}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={language === "th" ? "ค้นหา..." : "Search..."}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
                {/* Sort Filter */}
                <Select value={sortBy} onValueChange={(value: any) => {
                  setSortBy(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      {language === "th" ? "ล่าสุด" : "Newest"}
                    </SelectItem>
                    <SelectItem value="oldest">
                      {language === "th" ? "เก่าที่สุด" : "Oldest"}
                    </SelectItem>
                    <SelectItem value="price-high">
                      {language === "th" ? "ราคาสูง-ต่ำ" : "Price: High-Low"}
                    </SelectItem>
                    <SelectItem value="price-low">
                      {language === "th" ? "ราคาต่ำ-สูง" : "Price: Low-High"}
                    </SelectItem>
                    <SelectItem value="customer">
                      {language === "th" ? "ตามชื่อลูกค้า" : "By Customer"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder={language === "th" ? "สถานะ" : "Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === "th" ? "ทั้งหมด" : "All"}
                    </SelectItem>
                    <SelectItem value="pending">
                      {getRepairStatusLabel("pending", language)}
                    </SelectItem>
                    <SelectItem value="in-progress">
                      {getRepairStatusLabel("in-progress", language)}
                    </SelectItem>
                    <SelectItem value="completed">
                      {getRepairStatusLabel("completed", language)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAndSortedRepairs.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                {searchQuery || statusFilter !== "all"
                  ? (language === "th" ? "ไม่พบผลการค้นหา" : "No results found")
                  : (language === "th" ? "ยังไม่มีงานซ่อมในระบบ" : "No repairs in the system.")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left p-3 font-medium">{t("orderId")}</th>
                      <th className="text-left p-3 font-medium">{t("customer")}</th>
                      <th className="text-left p-3 font-medium">{t("device")}</th>
                      <th className="text-left p-3 font-medium">{t("issue")}</th>
                      <th className="text-right p-3 font-medium">{t("estCost")}</th>
                      <th className="text-right p-3 font-medium w-32">
                        {language === "th" ? "ใบเสร็จ" : "Receipt"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRepairs.map((item) => {
                      const isHighlight = highlightRepairId === item.id;
                      return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/30",
                          isHighlight && "bg-primary/10 border-l-4 border-l-primary"
                        )}
                      >
                        <td className={cn("p-3 font-mono", isHighlight ? "text-foreground font-semibold" : "text-muted-foreground")}>{item.id}</td>
                        <td className="p-3">
                          <div className={cn(isHighlight && "font-semibold text-foreground")}>{item.customer}</div>
                          {item.phone && (
                            <div className={cn("text-xs mt-0.5", isHighlight ? "text-foreground/80" : "text-muted-foreground")}>{item.phone}</div>
                          )}
                        </td>
                        <td className={cn("p-3", isHighlight && "font-medium text-foreground")}>{item.device}</td>
                        <td className={cn("p-3", isHighlight && "font-medium text-foreground")}>
                          {language === "th" ? item.issueTh : item.issue}
                        </td>
                        <td className={cn("p-3 text-right", isHighlight && "font-semibold text-foreground")}>
                          ฿{item.estimatedCost.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => handleIssueReceipt(item)}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {language === "th" ? "ออกใบเสร็จ" : "Receipt"}
                          </Button>
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          {/* Results count and Pagination */}
          {filteredAndSortedRepairs.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground text-center px-4 pb-2">
                {language === "th"
                  ? `แสดง ${startIndex + 1}-${Math.min(endIndex, filteredAndSortedRepairs.length)} จาก ${filteredAndSortedRepairs.length} รายการ`
                  : `Showing ${startIndex + 1}-${Math.min(endIndex, filteredAndSortedRepairs.length)} of ${filteredAndSortedRepairs.length} items`}
              </div>
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
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
};

export default RepairBill;
