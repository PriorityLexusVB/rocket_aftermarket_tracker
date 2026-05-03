import React from 'react'
// Static per-icon imports — required to enable tree-shaking on lucide-react.
// `import * as LucideIcons from 'lucide-react'` defeats tree-shaking because
// dynamic name lookup forces the bundler to include every icon. This map is
// generated from `<Icon name="..."/>` and `<AppIcon name="..."/>` usages
// across the app — keep it in sync if new icon names are added.
import Activity from 'lucide-react/dist/esm/icons/activity.js'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js'
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down.js'
import BadgeCheck from 'lucide-react/dist/esm/icons/badge-check.js'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js'
import Bell from 'lucide-react/dist/esm/icons/bell.js'
import Briefcase from 'lucide-react/dist/esm/icons/briefcase.js'
import Building from 'lucide-react/dist/esm/icons/building.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Check from 'lucide-react/dist/esm/icons/check.js'
import CheckCheck from 'lucide-react/dist/esm/icons/check-check.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js'
import Circle from 'lucide-react/dist/esm/icons/circle.js'
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import Database from 'lucide-react/dist/esm/icons/database.js'
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign.js'
import Download from 'lucide-react/dist/esm/icons/download.js'
import Edit from 'lucide-react/dist/esm/icons/edit.js'
import Eye from 'lucide-react/dist/esm/icons/eye.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import FileX from 'lucide-react/dist/esm/icons/file-x.js'
import Filter from 'lucide-react/dist/esm/icons/filter.js'
import Globe from 'lucide-react/dist/esm/icons/globe.js'
import Hash from 'lucide-react/dist/esm/icons/hash.js'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle.js'
import History from 'lucide-react/dist/esm/icons/history.js'
import Home from 'lucide-react/dist/esm/icons/home.js'
import Info from 'lucide-react/dist/esm/icons/info.js'
import Keyboard from 'lucide-react/dist/esm/icons/keyboard.js'
import Loader from 'lucide-react/dist/esm/icons/loader.js'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js'
import Lock from 'lucide-react/dist/esm/icons/lock.js'
import Mail from 'lucide-react/dist/esm/icons/mail.js'
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import Palette from 'lucide-react/dist/esm/icons/palette.js'
import Pencil from 'lucide-react/dist/esm/icons/pencil.js'
import Percent from 'lucide-react/dist/esm/icons/percent.js'
import Phone from 'lucide-react/dist/esm/icons/phone.js'
import Play from 'lucide-react/dist/esm/icons/play.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import Receipt from 'lucide-react/dist/esm/icons/receipt.js'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Settings from 'lucide-react/dist/esm/icons/settings.js'
import Shield from 'lucide-react/dist/esm/icons/shield.js'
import Star from 'lucide-react/dist/esm/icons/star.js'
import Timer from 'lucide-react/dist/esm/icons/timer.js'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down.js'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import Users from 'lucide-react/dist/esm/icons/users.js'
import Workflow from 'lucide-react/dist/esm/icons/workflow.js'
import Wrench from 'lucide-react/dist/esm/icons/wrench.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Zap from 'lucide-react/dist/esm/icons/zap.js'

const ICON_MAP = {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, ArrowUpDown,
  BadgeCheck, BarChart3, Bell, Briefcase, Building, Calendar, Car, Check,
  CheckCheck, CheckCircle, ChevronDown, ChevronRight, Circle, ClipboardCheck,
  Clock, Copy, Database, DollarSign, Download, Edit, Eye, FileText, FileX,
  Filter, Globe, Hash, HelpCircle, History, Home, Info, Keyboard, Loader,
  Loader2, Lock, Mail, MapPin, MessageSquare, Package, Palette, Pencil,
  Percent, Phone, Play, Plus, Receipt, RotateCcw, Search, Settings, Shield,
  Star, Timer, Trash2, TrendingDown, TrendingUp, User, Users, Workflow,
  Wrench, X, Zap,
}

function Icon({
  name,
  size = 24,
  color = 'currentColor',
  className = '',
  strokeWidth = 2,
  ...props
}) {
  const IconComponent = ICON_MAP[name]

  if (!IconComponent) {
    return (
      <HelpCircle
        size={size}
        color="gray"
        strokeWidth={strokeWidth}
        className={className}
        {...props}
      />
    )
  }

  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      {...props}
    />
  )
}
export default Icon
