import { RecentRepairs } from "@/components/dashboard/RecentRepairs";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRepairs } from "@/contexts/RepairsContext";
import { apiClient } from "@/lib/api";
import { DollarSign, Package, Users, Wrench } from "lucide-react";
import { useEffect, useState, useMemo } from "react";

const Dashboard = () => {
  const { t } = useLanguage();
  const { repairs } = useRepairs();
  const [parts, setParts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [revenueChange, setRevenueChange] = useState<number>(0);
  const [isLoadingParts, setIsLoadingParts] = useState(true);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);

  // ดึงข้อมูล parts จาก API
  useEffect(() => {
    const loadParts = async () => {
      setIsLoadingParts(true);
      try {
        const response = await apiClient.getParts();
        if (response.status === "success" && response.data) {
          setParts(response.data);
        } else {
          console.error("Failed to load parts:", response.message);
          setParts([]);
        }
      } catch (error) {
        console.error("Error loading parts:", error);
        setParts([]);
      } finally {
        setIsLoadingParts(false);
      }
    };

    loadParts();
  }, []);

  // ดึงข้อมูล customers จาก API
  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        const response = await apiClient.getCustomers();
        if (response.status === "success" && response.data) {
          setCustomers(response.data);
        } else {
          console.error("Failed to load customers:", response.message);
          setCustomers([]);
        }
      } catch (error) {
        console.error("Error loading customers:", error);
        setCustomers([]);
      } finally {
        setIsLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, []);

  // ดึงข้อมูลรายได้วันนี้
  useEffect(() => {
    const loadTodayRevenue = async () => {
      setIsLoadingRevenue(true);
      try {
        const response = await apiClient.getTodayRevenue();
        if (response.status === "success" && response.data) {
          setTodayRevenue(response.data.todayRevenue);
          setRevenueChange(response.data.revenueChange);
        } else {
          console.error("Failed to load today revenue:", response.message);
          setTodayRevenue(0);
          setRevenueChange(0);
        }
      } catch (error) {
        console.error("Error loading today revenue:", error);
        setTodayRevenue(0);
        setRevenueChange(0);
      } finally {
        setIsLoadingRevenue(false);
      }
    };

    loadTodayRevenue();
  }, []);

  // นับจำนวนงานซ่อมที่กำลังดำเนินการ
  const activeRepairsCount = useMemo(() => {
    return repairs.filter((repair) => repair.status === "in-progress").length;
  }, [repairs]);

  // นับจำนวน parts ทั้งหมด
  const totalPartsCount = useMemo(() => {
    return parts.length;
  }, [parts]);

  // คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง (สำหรับงานซ่อม - เปรียบเทียบกับสัปดาห์ที่แล้ว)
  // เนื่องจากยังไม่มีข้อมูลจากช่วงเวลาที่ผ่านมา ใช้ค่า mock ชั่วคราว
  const activeRepairsChange = useMemo(() => {
    // TODO: คำนวณจากข้อมูลจริงเมื่อมีข้อมูลจากช่วงเวลาที่ผ่านมา
    return 12; // mock value
  }, []);

  // คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง (สำหรับ parts - เปรียบเทียบกับเดือนที่แล้ว)
  const partsChange = useMemo(() => {
    // TODO: คำนวณจากข้อมูลจริงเมื่อมีข้อมูลจากช่วงเวลาที่ผ่านมา
    return -5; // mock value
  }, []);

  // คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง (สำหรับลูกค้า - เปรียบเทียบกับเดือนที่แล้ว)
  const customersChange = useMemo(() => {
    if (customers.length === 0 || isLoadingCustomers) return 0;
    
    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const thisMonthCount = customers.filter((customer) => {
      const customerDate = new Date(customer.createdAt);
      return customerDate >= firstDayOfThisMonth;
    }).length;

    const lastMonthCount = customers.filter((customer) => {
      const customerDate = new Date(customer.createdAt);
      return customerDate >= firstDayOfLastMonth && customerDate < firstDayOfThisMonth;
    }).length;

    if (lastMonthCount === 0) return thisMonthCount > 0 ? 100 : 0;
    
    const change = ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
    return Math.round(change);
  }, [customers, isLoadingCustomers]);

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="page-title">{t("dashboard")}</h1>
            <p className="page-description">{t("dashboardWelcome")}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          title={t("activeRepairs")}
          value={activeRepairsCount}
          change={activeRepairsChange}
          changeLabel={t("vsLastWeek")}
          icon={<Wrench className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/10"
        />
        <StatCard
          title={t("partsInStock")}
          value={isLoadingParts ? "..." : totalPartsCount}
          change={partsChange}
          changeLabel={t("vsLastMonth")}
          icon={<Package className="w-5 h-5 text-status-pending" />}
          iconBg="bg-status-pending/10"
        />
        <StatCard
          title={t("todaysRevenue")}
          value={isLoadingRevenue ? "..." : `฿${todayRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-5 h-5 text-status-completed" />}
          iconBg="bg-status-completed/10"
        />
        <StatCard
          title={t("customers")}
          value={isLoadingCustomers ? "..." : customers.length}
          change={customersChange}
          changeLabel={t("newThisMonth")}
          icon={<Users className="w-5 h-5 text-chart-4" />}
          iconBg="bg-chart-4/10"
        />
      </div>

      {/* Charts and Alerts Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <StockAlerts />
        </div>
      </div>

      {/* Recent Repairs */}
      <RecentRepairs />
    </MainLayout>
  );
};

export default Dashboard;
