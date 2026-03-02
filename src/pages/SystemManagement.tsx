import { MainLayout } from "@/components/layout/MainLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ArrowRight, FileText, UserCircle, Users, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SystemManagement = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isTh = language === "th";
  const isOwner = currentUser?.role === "owner";

  const handleMenuClick = (item: typeof menuItems[0]) => {
    // ตรวจสอบว่าเป็น owner หรือไม่ สำหรับ menu items ที่ต้องเป็น owner
    const ownerOnlyItems = ["users", "line-templates"];
    if (ownerOnlyItems.includes(item.id) && !isOwner) {
      toast.error(
        isTh 
          ? "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ กรุณาติดต่อผู้ดูแลระบบ" 
          : "You do not have permission to access this section. Please contact the system administrator."
      );
      return;
    }
    navigate(item.path);
  };

  const menuItems = [
    {
      id: "users",
      titleTh: "จัดการผู้ใช้",
      titleEn: "User Management",
      descriptionTh: "จัดการข้อมูลผู้ใช้ในระบบ",
      descriptionEn: "Manage user information in the system",
      icon: Users,
      path: "/admin/users",
      gradient: "from-violet-500 to-purple-600",
      iconBg: "bg-white/20",
      iconColor: "text-white",
      cardBorder: "hover:border-violet-400/50",
      cardShadow: "hover:shadow-[0_12px_40px_-8px_rgba(139,92,246,0.25)]",
      accent: "bg-violet-500",
      ownerOnly: true,
    },
    {
      id: "line-templates",
      titleTh: "Template ข้อความ LINE",
      titleEn: "LINE Message Templates",
      descriptionTh: "จัดการเทมเพลตข้อความแจ้งเตือนสถานะการซ่อม",
      descriptionEn: "Manage repair status notification message templates",
      icon: FileText,
      path: "/system/line/templates",
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-white/20",
      iconColor: "text-white",
      cardBorder: "hover:border-blue-400/50",
      cardShadow: "hover:shadow-[0_12px_40px_-8px_rgba(59,130,246,0.25)]",
      accent: "bg-blue-500",
      ownerOnly: true,
    },
    {
      id: "customers",
      titleTh: "ดูข้อมูลลูกค้า",
      titleEn: "Customer Management",
      descriptionTh: "ดูและค้นหาข้อมูลลูกค้าทั้งหมด",
      descriptionEn: "View and search all customer information",
      icon: UserCircle,
      path: "/system/customers",
      gradient: "from-cyan-500 to-teal-600",
      iconBg: "bg-white/20",
      iconColor: "text-white",
      cardBorder: "hover:border-cyan-400/50",
      cardShadow: "hover:shadow-[0_12px_40px_-8px_rgba(6,182,212,0.25)]",
      accent: "bg-cyan-500",
      ownerOnly: false,
    },
  ];

  return (
    <MainLayout>
      <div className="page-header mb-8">
        <h1 className="page-title">
          {isTh ? "จัดการระบบ" : "System Management"}
        </h1>
        <p className="page-description">
          {isTh
            ? "จัดการระบบและบัญชีผู้ใช้"
            : "Manage system and user accounts"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = item.ownerOnly && !isOwner;
          return (
            <div
              key={item.id}
              onClick={() => !isDisabled && handleMenuClick(item)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border/60 bg-card p-6",
                "transition-all duration-300 ease-out",
                isDisabled 
                  ? "opacity-60 cursor-not-allowed" 
                  : "cursor-pointer hover:scale-[1.02] hover:border-opacity-100 hover:shadow-xl",
                !isDisabled && item.cardBorder,
                !isDisabled && item.cardShadow
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className={cn(
                    "flex items-center justify-center w-14 h-14 rounded-2xl flex-shrink-0 transition-transform duration-300",
                    !isDisabled && "group-hover:scale-110",
                    "bg-gradient-to-br",
                    item.gradient
                  )}
                >
                  {isDisabled ? (
                    <Lock className={cn("w-7 h-7", item.iconColor)} />
                  ) : (
                    <Icon className={cn("w-7 h-7", item.iconColor)} />
                  )}
                </span>
                {!isDisabled && (
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0",
                      item.accent,
                      item.iconColor
                    )}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                <h3 className="font-bold text-lg tracking-tight text-foreground">
                  {isTh ? item.titleTh : item.titleEn}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {isTh ? item.descriptionTh : item.descriptionEn}
                </p>
                {isDisabled && (
                  <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {isTh ? "เฉพาะผู้ดูแลระบบ" : "Admin only"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </MainLayout>
  );
};

export default SystemManagement;
