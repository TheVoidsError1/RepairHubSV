import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    DollarSign,
    Download,
    Eye,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import * as XLSX from 'xlsx';

const Finance = () => {
  const { t, language } = useLanguage();
  const [timeRange, setTimeRange] = useState("1d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Financial summary state
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalPartsCost: 0,
    totalPartsSalePrice: 0,
    partsMarkup: 0,
    partsMarkupPercentage: 0,
    totalLaborCost: 0,
    incomeChange: 0,
    expensesChange: 0,
    profitChange: 0,
    profitMargin: 0,
    totalStockValue: 0,
    totalStockQuantity: 0,
    averageProfitPerRepair: 0,
    totalRepairs: 0,
  });

  // Chart data state
  const [chartData, setChartData] = useState<Array<{
    month?: string;
    monthTh?: string;
    name: string;
    nameEn?: string;
    date?: string;
    income: number;
    expenses: number;
  }>>([]);

  // Expense breakdown state
  const [expenseBreakdown, setExpenseBreakdown] = useState<Array<{
    name: string;
    nameTh: string;
    value: number;
    amount: number;
    color: string;
  }>>([]);

  // Transactions state
  const [transactions, setTransactions] = useState<Array<{
    id: string;
    type: "income" | "expense";
    description: string;
    descriptionTh: string;
    amount: number;
    date: string;
    method: string;
    methodTh: string;
    repairId?: string; // Repair number for income transactions
  }>>([]);

  const [transactionTab, setTransactionTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Repair details dialog state
  const [repairDetailsOpen, setRepairDetailsOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [loadingRepairDetails, setLoadingRepairDetails] = useState(false);

  // Fetch financial data
  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Determine which chart API to call based on timeRange
        let chartPromise;
        if (timeRange === '1d') {
          chartPromise = apiClient.getDailyIncomeExpenses();
        } else if (timeRange === '1w') {
          chartPromise = apiClient.getWeeklyIncomeExpenses();
        } else {
          chartPromise = apiClient.getIncomeExpensesChart(timeRange);
        }

        // Fetch all data in parallel (always fetch all transactions, filter on frontend)
        const [summaryRes, chartRes, breakdownRes, transactionsRes] = await Promise.all([
          apiClient.getFinancialSummary(timeRange),
          chartPromise,
          apiClient.getExpenseBreakdown(timeRange),
          apiClient.getTransactions(timeRange, 'all', 100), // Fetch all, filter on frontend
        ]);

        if (summaryRes.status === "success" && summaryRes.data) {
          setSummary(summaryRes.data);
        }

        if (chartRes.status === "success" && chartRes.data) {
          let formattedChartData;
          if (timeRange === '1d' || timeRange === '1w') {
            // For daily or weekly charts (same shape: name, nameEn, date?, income, expenses)
            formattedChartData = chartRes.data.map((d: any) => ({
              ...d,
              name: language === "th" ? d.name : (d.nameEn || d.name),
            }));
          } else {
            // For monthly charts
            formattedChartData = chartRes.data.map((d: any) => ({
              ...d,
              name: language === "th" ? d.monthTh : d.month,
            }));
          }
          setChartData(formattedChartData);
        }

        if (breakdownRes.status === "success" && breakdownRes.data) {
          // Map expense breakdown with colors
          const colors = [
            "hsl(217, 91%, 60%)", // Blue for parts
            "hsl(142, 71%, 45%)", // Green for labor
            "hsl(45, 93%, 47%)",  // Yellow for utilities
            "hsl(280, 65%, 60%)", // Purple for other
          ];
          const formattedBreakdown = breakdownRes.data.map((item, index) => ({
            ...item,
            name: language === "th" ? item.nameTh : (t(item.name as any) || item.name),
            color: colors[index % colors.length],
          }));
          setExpenseBreakdown(formattedBreakdown);
        }

        if (transactionsRes.status === "success" && transactionsRes.data) {
          console.log('[Finance] Transactions received:', transactionsRes.data.length, 'transactions');
          console.log('[Finance] Transactions data:', transactionsRes.data);
          setTransactions(transactionsRes.data);
        } else {
          console.error('[Finance] Transactions response:', transactionsRes);
        }
      } catch (err) {
        console.error("Error fetching financial data:", err);
        setError(err instanceof Error ? err.message : "Failed to load financial data");
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [timeRange, language, t]);

  // Filter transactions based on selected tab
  const filteredTransactions = transactionTab === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === transactionTab);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [transactionTab]);

  console.log('[Finance] Current transactions:', transactions.length);
  console.log('[Finance] Filtered transactions:', filteredTransactions.length);
  console.log('[Finance] Transaction tab:', transactionTab);

  // Handle viewing repair details
  const handleViewRepairDetails = async (transactionId: string, repairId?: string) => {
    setLoadingRepairDetails(true);
    setRepairDetailsOpen(true);
    
    try {
      let repairNumber = repairId;
      
      // ถ้าไม่มี repairId ให้ลอง extract จาก transaction ID (fallback)
      if (!repairNumber) {
        // Extract repair ID from transaction ID (e.g., TXN-REP-2026-009 -> REP-2026-009)
        repairNumber = transactionId.replace('TXN-REP-', 'REP-');
      }
      
      if (!repairNumber || repairNumber === 'N/A') {
        console.log('Repair number not found in transaction');
        setSelectedRepair(null);
        return;
      }
      
      const response = await apiClient.getRepairs(1, 1000); // Get all repairs
      const repair = response.data.find((r: any) => r.repairNumber === repairNumber);
      
      if (repair) {
        // Fetch detailed repair info including parts
        const detailResponse = await apiClient.getRepairById(repair.id);
        console.log('Repair detail response:', detailResponse);
        setSelectedRepair(detailResponse.data || detailResponse);
      } else {
        console.log('Repair not found:', repairNumber);
        setSelectedRepair(null);
      }
    } catch (error) {
      console.error('Error fetching repair details:', error);
      setSelectedRepair(null);
    } finally {
      setLoadingRepairDetails(false);
    }
  };

  // Create financial breakdown data for pie chart
  // Calculate percentages relative to a base that ensures correct percentage distribution
  // Base = totalIncome + totalExpenses to get proper percentage distribution
  // This ensures totalExpenses is not 100% but a percentage of the total financial activity
  const totalBase = summary.totalIncome + summary.totalExpenses > 0
    ? summary.totalIncome + summary.totalExpenses
    : summary.totalExpenses + summary.partsMarkup + summary.averageProfitPerRepair;
  const financialBreakdown = totalBase > 0 ? [
    {
      name: language === "th" ? "รายได้รวม" : "Total Income",
      nameTh: "รายได้รวม",
      value: (summary.totalIncome / totalBase) * 100,
      amount: summary.totalIncome,
      color: "hsl(142, 71%, 45%)", // Green
    },
    {
      name: language === "th" ? "ต้นทุนอะไหล่" : "Cost of Parts",
      nameTh: "ต้นทุนอะไหล่",
      value: (summary.totalPartsCost / totalBase) * 100,
      amount: summary.totalPartsCost,
      color: "hsl(217, 91%, 60%)", // Blue
    },
    {
      name: language === "th" ? "ค่าใช้จ่ายรวม" : "Total Expenses",
      nameTh: "ค่าใช้จ่ายรวม",
      value: (summary.totalExpenses / totalBase) * 100,
      amount: summary.totalExpenses,
      color: "hsl(0, 84%, 60%)", // Red
    },
    {
      name: language === "th" ? "กำไรจากอะไหล่" : "Profit from Parts",
      nameTh: "กำไรจากอะไหล่",
      value: (summary.partsMarkup / totalBase) * 100,
      amount: summary.partsMarkup,
      color: "hsl(142, 76%, 55%)", // Light Green
    },
    {
      name: language === "th" ? "กำไรเฉลี่ยต่องาน" : "Avg Profit per Job",
      nameTh: "กำไรเฉลี่ยต่องาน",
      value: (summary.averageProfitPerRepair / totalBase) * 100,
      amount: summary.averageProfitPerRepair,
      color: "hsl(45, 93%, 47%)", // Yellow/Orange
    },
  ].filter(item => item.value > 0) : [];

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <p className="text-status-cancelled mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Export to Excel function
  const handleExportToExcel = () => {
    try {
      // สร้างข้อมูลสรุปทางการเงิน
      const summaryData = [
        [language === "th" ? "รายการ" : "Item", language === "th" ? "จำนวน" : "Amount"],
        [language === "th" ? "รายได้รวม" : "Total Income", `฿${summary.totalIncome.toLocaleString()}`],
        [language === "th" ? "ค่าใช้จ่ายรวม" : "Total Expenses", `฿${summary.totalExpenses.toLocaleString()}`],
        [language === "th" ? "กำไรสุทธิ" : "Net Profit", `฿${summary.netProfit.toLocaleString()}`],
        [language === "th" ? "อัตรากำไร" : "Profit Margin", `${summary.profitMargin.toFixed(2)}%`],
        [language === "th" ? "มูลค่าสต็อก" : "Stock Value", `฿${summary.totalStockValue.toLocaleString()}`],
        [language === "th" ? "กำไรเฉลี่ยต่องาน" : "Avg Profit per Job", `฿${summary.averageProfitPerRepair.toLocaleString()}`],
        [language === "th" ? "กำไรจากอะไหล่" : "Parts Profit", `฿${summary.partsMarkup.toLocaleString()}`],
        [language === "th" ? "จำนวนงานซ่อม" : "Total Repairs", summary.totalRepairs.toString()],
      ];

      // สร้างข้อมูลธุรกรรม
      const transactionsData = [
        [
          language === "th" ? "เลขที่ธุรกรรม" : "Transaction ID",
          language === "th" ? "ประเภท" : "Type",
          language === "th" ? "รายละเอียด" : "Description",
          language === "th" ? "จำนวนเงิน" : "Amount",
          language === "th" ? "วันที่" : "Date",
          language === "th" ? "วิธีการชำระ" : "Method",
        ],
        ...filteredTransactions.map(tx => [
          tx.id,
          tx.type === 'income' ? (language === "th" ? "รายได้" : "Income") : (language === "th" ? "รายจ่าย" : "Expense"),
          language === "th" ? tx.descriptionTh : tx.description,
          `฿${tx.amount.toLocaleString()}`,
          tx.date,
          language === "th" ? tx.methodTh : tx.method,
        ])
      ];

      // สร้าง workbook
      const wb = XLSX.utils.book_new();

      // สร้าง worksheet สำหรับสรุปทางการเงิน
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, language === "th" ? "สรุปทางการเงิน" : "Financial Summary");

      // สร้าง worksheet สำหรับธุรกรรม
      const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(wb, wsTransactions, language === "th" ? "รายการธุรกรรม" : "Transactions");

      // สร้างชื่อไฟล์
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const fileName = `Financial_Report_${dateStr}.xlsx`;

      // Export ไฟล์
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">{t("financeWarehouse")}</h1>
            <p className="page-description">{t("financeDescription")}</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">{t("daily")}</SelectItem>
                <SelectItem value="1w">{t("weekly")}</SelectItem>
                <SelectItem value="1m">{t("lastMonth")}</SelectItem>
                <SelectItem value="3m">{t("last3Months")}</SelectItem>
                <SelectItem value="6m">{t("last6Months")}</SelectItem>
                <SelectItem value="1y">{t("lastYear")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={handleExportToExcel}>
              <Download className="w-4 h-4" />
              {t("export")}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("totalIncome")}</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className={`flex items-center gap-1 mt-2 ${summary.incomeChange >= 0 ? "text-status-completed" : "text-status-cancelled"}`}>
                {summary.incomeChange >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {summary.incomeChange >= 0 ? "+" : ""}{summary.incomeChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-status-completed/10">
              <ArrowUpRight className="w-5 h-5 text-status-completed" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("totalExpenses")}</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className={`flex items-center gap-1 mt-2 ${summary.expensesChange >= 0 ? "text-status-cancelled" : "text-status-completed"}`}>
                {summary.expensesChange >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {summary.expensesChange >= 0 ? "+" : ""}{summary.expensesChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-status-cancelled/10">
              <ArrowDownRight className="w-5 h-5 text-status-cancelled" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("netProfit")}</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className={`flex items-center gap-1 mt-2 ${summary.profitChange >= 0 ? "text-status-completed" : "text-status-cancelled"}`}>
                {summary.profitChange >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {summary.profitChange >= 0 ? "+" : ""}{summary.profitChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">อัตรากำไร</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                {summary.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                จากรายได้ทั้งหมด
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">มูลค่าสต็อก</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalStockQuantity.toLocaleString()} ชิ้น
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">กำไรเฉลี่ยต่องาน</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.averageProfitPerRepair.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalRepairs} งาน
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">กำไรจากอะไหล่</p>
              <p className="text-2xl font-semibold mt-1 text-foreground">
                ฿{summary.partsMarkup.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.partsMarkupPercentage.toFixed(1)}% จากต้นทุน
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10">
              <ArrowUpRight className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t("incomeVsExpenses")}
          </h3>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%" barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis
                  dataKey="name"
                  stroke="hsl(215, 16%, 47%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(215, 16%, 47%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (value >= 1000000) {
                      return `฿${(value / 1000000).toFixed(1)}M`;
                    } else if (value >= 1000) {
                      return `฿${(value / 1000).toFixed(1)}k`;
                    } else {
                      return `฿${value.toFixed(0)}`;
                    }
                  }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(214, 32%, 91%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => {
                    const formattedValue = typeof value === 'number' 
                      ? `฿${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : value;
                    return [formattedValue, name === 'income' ? (language === "th" ? "รายรับ" : "Income") : (language === "th" ? "รายจ่าย" : "Expenses")];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar
                  dataKey="income"
                  fill="hsl(142, 71%, 45%)"
                  radius={[4, 4, 0, 0]}
                  name={language === "th" ? "รายรับ" : "Income"}
                />
                <Bar
                  dataKey="expenses"
                  fill="hsl(0, 84%, 60%)"
                  radius={[4, 4, 0, 0]}
                  name={language === "th" ? "รายจ่าย" : "Expenses"}
                />
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t("expenseBreakdown")}
          </h3>
          <div className="h-[200px]">
            {financialBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financialBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {financialBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, entry: any) => {
                      const percentage = typeof value === 'number' ? value.toFixed(1) : value;
                      const amount = entry?.payload?.amount || 0;
                      const label = entry?.payload?.name || name;
                      return [
                        `${percentage}% (฿${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                        label
                      ];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(0, 0%, 100%)",
                      border: "1px solid hsl(214, 32%, 91%)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </div>
          <div className="space-y-2 mt-4">
            {/* Expense Breakdown Items */}
            {expenseBreakdown
              .filter(item => item.nameTh !== "ต้นทุนอะไหล่" && item.name !== "Cost of Parts")
              .map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{item.value.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">
                      ฿{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          
          {/* Additional Financial Metrics */}
          <div className="mt-6 pt-6 border-t border-border space-y-3">
            {financialBreakdown.map((item, index) => (
              <div 
                key={item.name} 
                className={`flex items-center justify-between ${index > 0 ? 'pt-2 border-t border-border/50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={`text-sm ${index === 0 ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <div 
                    className="text-sm font-semibold"
                    style={{ color: item.color }}
                  >
                    {item.value.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ฿{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-card rounded-xl border border-border">
        <Tabs value={transactionTab} onValueChange={setTransactionTab} className="w-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              {t("recentTransactions")}
            </h3>
            <TabsList>
              <TabsTrigger value="all">{t("all")}</TabsTrigger>
              <TabsTrigger value="income">{t("income")}</TabsTrigger>
              <TabsTrigger value="expense">{t("expenses")}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all" className="mt-0">
            <div className="overflow-x-auto min-w-full">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>{t("transactionId")}</th>
                    <th>{t("description")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("date")}</th>
                    <th>{t("method")}</th>
                    <th className="text-center">{language === "th" ? "ดูรายละเอียด" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((txn) => {
                      const isRepairIncome = txn.id.startsWith('TXN-REP-');
                      return (
                        <tr key={txn.id}>
                          <td className="font-medium text-foreground">{txn.id}</td>
                          <td>{language === "th" ? txn.descriptionTh : txn.description}</td>
                          <td
                            className={
                              txn.type === "income"
                                ? "text-status-completed font-medium"
                                : "text-status-cancelled font-medium"
                            }
                          >
                            {txn.type === "income" ? "+" : "-"}฿{txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>{txn.date}</td>
                          <td>{language === "th" ? txn.methodTh : txn.method}</td>
                          <td className="text-center">
                            {isRepairIncome && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleViewRepairDetails(txn.id, (txn as any).repairId)}
                              >
                                <Eye className="w-4 h-4" />
                                {language === "th" ? "ดู" : "View"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
          </TabsContent>
          <TabsContent value="income" className="mt-0">
            <div className="overflow-x-auto min-w-full">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>{t("transactionId")}</th>
                    <th>{t("description")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("date")}</th>
                    <th>{t("method")}</th>
                    <th className="text-center">{language === "th" ? "ดูรายละเอียด" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((txn) => {
                      const isRepairIncome = txn.id.startsWith('TXN-REP-');
                      return (
                        <tr key={txn.id}>
                          <td className="font-medium text-foreground">{txn.id}</td>
                          <td>{language === "th" ? txn.descriptionTh : txn.description}</td>
                          <td className="text-status-completed font-medium">
                            +฿{txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>{txn.date}</td>
                          <td>{language === "th" ? txn.methodTh : txn.method}</td>
                          <td className="text-center">
                            {isRepairIncome && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleViewRepairDetails(txn.id, (txn as any).repairId)}
                              >
                                <Eye className="w-4 h-4" />
                                {language === "th" ? "ดู" : "View"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
          </TabsContent>
          <TabsContent value="expense" className="mt-0">
            <div className="overflow-x-auto min-w-full">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>{t("transactionId")}</th>
                    <th>{t("description")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("date")}</th>
                    <th>{t("method")}</th>
                    <th className="text-center">{language === "th" ? "ดูรายละเอียด" : "Details"}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((txn) => (
                        <tr key={txn.id}>
                          <td className="font-medium text-foreground">{txn.id}</td>
                          <td>{language === "th" ? txn.descriptionTh : txn.description}</td>
                          <td className="text-status-cancelled font-medium">
                            -฿{txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>{txn.date}</td>
                          <td>{language === "th" ? txn.methodTh : txn.method}</td>
                          <td className="text-center">
                            {/* No details button for expense transactions */}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Repair Details Dialog */}
      <Dialog open={repairDetailsOpen} onOpenChange={setRepairDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "th" ? "รายละเอียดอะไหล่ที่ใช้" : "Parts Used Details"}
            </DialogTitle>
          </DialogHeader>
          {loadingRepairDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">
                  {language === "th" ? "กำลังโหลด..." : "Loading..."}
                </p>
              </div>
            </div>
          ) : selectedRepair ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "เลขที่งานซ่อม" : "Repair Number"}
                  </p>
                  <p className="font-medium">{selectedRepair.repairNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "ลูกค้า" : "Customer"}
                  </p>
                  <p className="font-medium">
                    {selectedRepair.customer
                      ? (selectedRepair.customer.fullName || `${selectedRepair.customer.firstName || ''} ${selectedRepair.customer.lastName || ''}`.trim())
                      : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">
                    {language === "th" ? "ยี่ห้อ/รุ่น" : "Brand/Model"}
                  </p>
                  <p className="font-medium">
                    {[selectedRepair.deviceBrand, selectedRepair.deviceModel]
                      .filter(Boolean)
                      .join(' ') || "-"}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">
                  {language === "th" ? "อะไหล่ที่ใช้" : "Parts Used"}
                </h4>
                {selectedRepair.selectedParts && selectedRepair.selectedParts.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRepair.selectedParts.map((part: any, index: number) => (
                      <div
                        key={part.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">
                              {language === "th" ? part.nameTh || part.name : part.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {language === "th" ? "ราคาทุน" : "Cost Price"}: ฿{Number(part.costPrice || 0).toFixed(2)} | {" "}
                              {language === "th" ? "ราคาขาย" : "Sale Price"}: ฿{Number(part.price || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            ฿{Number(part.price || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "th" ? "กำไร" : "Profit"}: ฿{(Number(part.price || 0) - Number(part.costPrice || 0)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">
                          {language === "th" ? "รวมราคาอะไหล่" : "Total Parts Cost"}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          ฿{selectedRepair.selectedParts
                            .reduce((sum: number, part: any) => sum + (Number(part.price) || 0), 0)
                            .toFixed(2)
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <p className="font-semibold text-status-completed">
                          {language === "th" ? "กำไรจากอะไหล่" : "Profit from Parts"}
                        </p>
                        <p className="text-lg font-bold text-status-completed">
                          ฿{selectedRepair.selectedParts
                            .reduce((sum: number, part: any) => sum + ((Number(part.price) || 0) - (Number(part.costPrice) || 0)), 0)
                            .toFixed(2)
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {language === "th" ? "ไม่มีการใช้อะไหล่" : "No parts used"}
                  </p>
                )}
              </div>

              {selectedRepair.totalCost && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-lg">
                      {language === "th" ? "ค่าบริการรวม" : "Total Service Cost"}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      ฿{Number(selectedRepair.totalCost || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {language === "th" ? "ไม่พบข้อมูล" : "No data found"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Finance;

