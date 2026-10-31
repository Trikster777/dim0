import { HomeIcon } from "@/components/icons"
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export const HomeMenuItem = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleClick = async () => {
    navigate({ to: '/home' })
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton className="text-xs text-secondary-foreground font-medium transition-all" onClick={handleClick}>
        <HomeIcon className="text-xs shrink-0 text-sidebar-icon-3" strokeWidth={2} />
        <span>{t('sidebar.nav.home')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
