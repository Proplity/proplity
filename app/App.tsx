'use client';

import { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { ForgotPassword } from './components/Auth/ForgotPassword';
import { useAuth } from '@/context/AuthContext';
import { Checkout } from './components/Checkout';
import { Dashboard } from './components/Dashboard';
import { PropertyDiscovery } from './components/PropertyDiscovery';
import { TenantManagement } from './components/TenantManagement';
import { MaintenanceBoard } from './components/MaintenanceBoard';
import { AIAssistant } from './components/AIAssistant';
import { RoleSwitcher, UserRole } from './components/RoleSwitcher';
import { TenantDashboard } from './components/TenantDashboard';
import { LandlordDashboard } from './components/LandlordDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { VendorDashboard } from './components/VendorDashboard';
import { VendorJobDetail } from './components/VendorJobDetail';
import { VendorCreateInvoice } from './components/VendorCreateInvoice';
import { ListProperty } from './components/ListProperty';
import { PropertyDetail } from './components/PropertyDetail';
import { TenantDetail } from './components/TenantDetail';
import { MaintenanceDetail } from './components/MaintenanceDetail';
import { MaintenanceRequestForm } from './components/MaintenanceRequestForm';
import { PropertyApplicationForm } from './components/PropertyApplicationForm';
import { ScheduleViewing } from './components/ScheduleViewing';
import { MessagingPortal } from './components/MessagingPortal';
import { AddTenantForm } from './components/AddTenantForm';
import { TenantPaymentHistory } from './components/TenantPaymentHistory';
import { TenantMaintenanceRequests } from './components/TenantMaintenanceRequests';
import { LandlordFeaturePage } from './components/LandlordFeaturePage';
import { TenantFeaturePage } from './components/TenantFeaturePage';
import { ServiceProviderFeaturePage } from './components/ServiceProviderFeaturePage';
import { NeighbourhoodReport } from './components/NeighbourhoodReport';
import { AdminReports } from './components/AdminReports';
import { PricingPage } from './components/PricingPage';
import { ContactPage } from './components/ContactPage';
import { AboutPage } from './components/AboutPage';
import { PublicPropertyDetail } from './components/PublicPropertyDetail';
import { DashboardBreakdownPage, BreakdownType } from './components/DashboardBreakdownPage';
import { AdminBreakdownPage, AdminBreakdownType } from './components/AdminBreakdownPage';
import {
  Home,
  Search,
  Users,
  Wrench,
  MessageSquare,
  Settings,
  Bell,
  User,
  Building2,
  BarChart3,
  FileText,
  Plus,
  DollarSign,
  Receipt,
  LogOut,
} from 'lucide-react';

type Page =
  | { type: 'dashboard' }
  | { type: 'discover' }
  | { type: 'tenants' }
  | { type: 'maintenance' }
  | { type: 'list-property' }
  | { type: 'property-detail'; propertyId: number }
  | { type: 'tenant-detail'; tenantId: number }
  | { type: 'maintenance-detail'; requestId: number }
  | { type: 'maintenance-request-form' }
  | {
      type: 'property-application';
      propertyId: number;
      propertyTitle: string;
      propertyPrice: string;
    }
  | {
      type: 'schedule-viewing';
      propertyId: number;
      propertyTitle: string;
      propertyAddress: string;
    }
  | { type: 'messages' }
  | { type: 'vendor-jobs' }
  | { type: 'vendor-invoices' }
  | { type: 'vendor-job-detail'; jobId: number }
  | { type: 'vendor-create-invoice'; jobId: number }
  | { type: 'add-tenant' }
  | { type: 'payment-history' }
  | { type: 'landlord-features' }
  | { type: 'tenant-features' }
  | { type: 'vendor-features' }
  | { type: 'tenant-maintenance' }
  | { type: 'neighbourhood-report' }
  | { type: 'breakdown'; breakdownType: BreakdownType }
  | { type: 'admin-breakdown'; breakdownType: AdminBreakdownType }
  | { type: 'reports' };

type AuthScreen = 'login' | 'register' | 'forgot-password' | null;

interface PricingPlan {
  name: string;
  price: string;
  units: string;
  features: string[];
}

export default function App() {
  const auth = useAuth();
  const [showLanding, setShowLanding] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [publicPropertyId, setPublicPropertyId] = useState<number | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>({ type: 'dashboard' });
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('manager');

  useEffect(() => {
    if (auth.user) {
      setIsAuthenticated(true);
      setShowLanding(false);
      if (auth.user.role) {
        setCurrentRole(auth.user.role as UserRole);
      }
    }
  }, [auth.user]);

  const resetPublicFlags = () => {
    setShowLanding(false);
    setShowPricing(false);
    setShowContact(false);
    setShowAbout(false);
    setPublicPropertyId(null);
  };
  const goHome = () => {
    setShowLanding(true);
    setShowPricing(false);
    setShowContact(false);
    setShowAbout(false);
    setPublicPropertyId(null);
    setCurrentPage({ type: 'dashboard' });
    setAuthScreen(null);
  };
  const goContact = () => {
    resetPublicFlags();
    setShowContact(true);
    setCurrentPage({ type: 'dashboard' });
  };
  const goPricing = () => {
    resetPublicFlags();
    setShowPricing(true);
    setCurrentPage({ type: 'dashboard' });
  };
  const goAbout = () => {
    resetPublicFlags();
    setShowAbout(true);
    setCurrentPage({ type: 'dashboard' });
  };
  const goPublicProperty = (id: number) => {
    resetPublicFlags();
    setPublicPropertyId(id);
    setCurrentPage({ type: 'dashboard' });
  };

  const publicNavProps = {
    onGoHome: goHome,
    onViewPricing: goPricing,
    onViewContact: goContact,
    onViewAbout: goAbout,
    onViewLandlordPage: () => {
      resetPublicFlags();
      setCurrentPage({ type: 'landlord-features' });
      setIsAuthenticated(false);
    },
    onViewTenantPage: () => {
      resetPublicFlags();
      setCurrentPage({ type: 'tenant-features' });
      setIsAuthenticated(false);
    },
    onViewVendorPage: () => {
      resetPublicFlags();
      setCurrentPage({ type: 'vendor-features' });
      setIsAuthenticated(false);
    },
  };

  // Public page checks run FIRST so nav links on feature pages work correctly.
  // (Feature page checks below match on currentPage.type which persists when
  //  navigating away — these flags override that stale value.)

  // Show public property detail
  if (publicPropertyId !== null && !isAuthenticated) {
    return (
      <PublicPropertyDetail
        propertyId={publicPropertyId}
        onGetStarted={() => {
          setPublicPropertyId(null);
          setAuthScreen('login');
        }}
        {...publicNavProps}
      />
    );
  }

  // Show about page
  if (showAbout && !isAuthenticated) {
    return (
      <AboutPage
        onGetStarted={() => {
          setShowAbout(false);
          setAuthScreen('login');
        }}
        {...publicNavProps}
      />
    );
  }

  // Show dedicated contact page
  if (showContact && !isAuthenticated) {
    return (
      <ContactPage
        onGetStarted={() => {
          setShowContact(false);
          setAuthScreen('login');
        }}
        {...publicNavProps}
      />
    );
  }

  // Show dedicated pricing page
  if (showPricing && !isAuthenticated) {
    return (
      <PricingPage
        onGetStarted={() => {
          setShowPricing(false);
          setAuthScreen('login');
        }}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan);
          setShowPricing(false);
          setAuthScreen('register');
        }}
        {...publicNavProps}
      />
    );
  }

  // Show feature pages (no auth required)
  if (!isAuthenticated && currentPage.type === 'landlord-features') {
    return (
      <LandlordFeaturePage
        onGetStarted={() => {
          setAuthScreen('register');
        }}
        {...publicNavProps}
      />
    );
  }
  if (!isAuthenticated && currentPage.type === 'tenant-features') {
    return (
      <TenantFeaturePage
        onGetStarted={() => {
          setAuthScreen('register');
        }}
        {...publicNavProps}
      />
    );
  }
  if (!isAuthenticated && currentPage.type === 'vendor-features') {
    return (
      <ServiceProviderFeaturePage
        onGetStarted={() => {
          setAuthScreen('register');
        }}
        {...publicNavProps}
      />
    );
  }

  // Show landing page
  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={() => {
          setShowLanding(false);
          setAuthScreen('login');
        }}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan);
          setShowLanding(false);
          setAuthScreen('register');
        }}
        onViewProperty={(propertyId) => goPublicProperty(propertyId)}
        onViewPricing={goPricing}
        onViewContact={goContact}
        onViewAbout={goAbout}
        onViewLandlordPage={() => {
          setShowLanding(false);
          setCurrentPage({ type: 'landlord-features' });
          setIsAuthenticated(false);
        }}
        onViewTenantPage={() => {
          setShowLanding(false);
          setCurrentPage({ type: 'tenant-features' });
          setIsAuthenticated(false);
        }}
        onViewVendorPage={() => {
          setShowLanding(false);
          setCurrentPage({ type: 'vendor-features' });
          setIsAuthenticated(false);
        }}
      />
    );
  }

  // Show authentication screens
  if (!isAuthenticated && authScreen) {
    if (authScreen === 'login') {
      return (
        <Login
          onLogin={(role) => {
            setCurrentRole(role as UserRole);
            setIsAuthenticated(true);
            setAuthScreen(null);
            setShowLanding(false);
          }}
          onSwitchToRegister={() => setAuthScreen('register')}
          onForgotPassword={() => setAuthScreen('forgot-password')}
        />
      );
    }

    if (authScreen === 'register') {
      return (
        <Register
          onRegister={(role) => {
            setCurrentRole(role as UserRole);
            // Only managers and landlords need to go through checkout
            if ((role === 'manager' || role === 'landlord') && selectedPlan) {
              setAuthScreen(null);
              // Checkout will be shown next
            } else {
              // Tenants and vendors register for free
              setIsAuthenticated(true);
              setAuthScreen(null);
              setShowLanding(false);
              setSelectedPlan(null);
            }
          }}
          onSwitchToLogin={() => setAuthScreen('login')}
        />
      );
    }

    if (authScreen === 'forgot-password') {
      return <ForgotPassword onBack={() => setAuthScreen('login')} />;
    }
  }

  // Show checkout for managers/landlords who selected a plan
  if (
    selectedPlan &&
    !isAuthenticated &&
    (currentRole === 'manager' || currentRole === 'landlord')
  ) {
    return (
      <Checkout
        plan={selectedPlan}
        onBack={() => {
          setSelectedPlan(null);
          setAuthScreen('register');
        }}
        onComplete={() => {
          setSelectedPlan(null);
          setIsAuthenticated(true);
          setShowLanding(false);
        }}
      />
    );
  }

  // Define tabs based on role
  const getTabsForRole = () => {
    switch (currentRole) {
      case 'manager':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: Home },
          { id: 'discover', label: 'Discover Properties', icon: Search },
          { id: 'tenants', label: 'Tenants', icon: Users },
          { id: 'maintenance', label: 'Maintenance', icon: Wrench },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ];
      case 'tenant':
        return [
          { id: 'dashboard', label: 'My Dashboard', icon: Home },
          { id: 'discover', label: 'Browse Properties', icon: Search },
          { id: 'payment-history', label: 'Payment History', icon: Receipt },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ];
      case 'landlord':
        return [
          { id: 'dashboard', label: 'Portfolio', icon: Building2 },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ];
      case 'vendor':
        return [
          { id: 'dashboard', label: 'My Jobs', icon: Wrench },
          { id: 'vendor-invoices', label: 'Invoices', icon: DollarSign },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
        ];
      case 'admin':
        return [
          { id: 'dashboard', label: 'System Overview', icon: BarChart3 },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'reports', label: 'Reports', icon: FileText },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabsForRole();

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
  };

  // Render content based on role and current page
  const renderContent = () => {
    // Handle detail pages
    if (currentPage.type === 'list-property') {
      return (
        <ListProperty
          onBack={() => setCurrentPage({ type: 'dashboard' })}
          userRole={currentRole === 'landlord' ? 'landlord' : 'manager'}
        />
      );
    }
    if (currentPage.type === 'property-detail') {
      return (
        <PropertyDetail
          propertyId={currentPage.propertyId}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
          onNavigate={navigateTo}
        />
      );
    }
    if (currentPage.type === 'tenant-detail') {
      return (
        <TenantDetail
          tenantId={currentPage.tenantId}
          onBack={() => setCurrentPage({ type: 'tenants' })}
        />
      );
    }
    if (currentPage.type === 'maintenance-detail') {
      return (
        <MaintenanceDetail
          requestId={currentPage.requestId}
          onBack={() => setCurrentPage({ type: 'maintenance' })}
        />
      );
    }
    if (currentPage.type === 'maintenance-request-form') {
      return (
        <MaintenanceRequestForm
          onBack={() => setCurrentPage({ type: 'dashboard' })}
          onSubmit={() => {
            alert(
              'Maintenance request submitted successfully! You will receive updates via SMS and email.',
            );
            setCurrentPage({ type: 'dashboard' });
          }}
        />
      );
    }
    if (currentPage.type === 'property-application') {
      return (
        <PropertyApplicationForm
          propertyId={currentPage.propertyId}
          propertyTitle={currentPage.propertyTitle}
          propertyPrice={currentPage.propertyPrice}
          onBack={() =>
            setCurrentPage({
              type: 'property-detail',
              propertyId: currentPage.propertyId,
            })
          }
          onSubmit={() => {
            alert(
              'Application submitted successfully! The property manager will review your application and contact you within 24-48 hours.',
            );
            setCurrentPage({ type: 'dashboard' });
          }}
        />
      );
    }
    if (currentPage.type === 'schedule-viewing') {
      return (
        <ScheduleViewing
          propertyId={currentPage.propertyId}
          propertyTitle={currentPage.propertyTitle}
          propertyAddress={currentPage.propertyAddress}
          onBack={() =>
            setCurrentPage({
              type: 'property-detail',
              propertyId: currentPage.propertyId,
            })
          }
          onSubmit={() => {
            setCurrentPage({
              type: 'property-detail',
              propertyId: currentPage.propertyId,
            });
          }}
        />
      );
    }
    if (currentPage.type === 'add-tenant') {
      return (
        <AddTenantForm
          onBack={() => setCurrentPage({ type: 'tenants' })}
          onComplete={() => {
            alert('Tenancy created successfully! An invitation has been sent to the tenant.');
            setCurrentPage({ type: 'tenants' });
          }}
        />
      );
    }
    if (currentPage.type === 'messages') {
      return (
        <MessagingPortal
          currentUserRole={currentRole}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
        />
      );
    }

    if (currentPage.type === 'breakdown') {
      return (
        <DashboardBreakdownPage
          breakdownType={currentPage.breakdownType}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
        />
      );
    }
    if (currentPage.type === 'admin-breakdown') {
      return (
        <AdminBreakdownPage
          breakdownType={currentPage.breakdownType}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
        />
      );
    }

    if (currentPage.type === 'vendor-job-detail') {
      return (
        <VendorJobDetail
          jobId={currentPage.jobId}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
          onNavigate={navigateTo}
        />
      );
    }

    if (currentPage.type === 'vendor-create-invoice') {
      return (
        <VendorCreateInvoice
          jobId={currentPage.jobId}
          onBack={() => setCurrentPage({ type: 'dashboard' })}
        />
      );
    }

    if (currentRole === 'tenant') {
      if (currentPage.type === 'dashboard') {
        return <TenantDashboard onNavigate={navigateTo} />;
      }
      if (currentPage.type === 'discover') {
        return <PropertyDiscovery onNavigate={navigateTo} />;
      }
      if (currentPage.type === 'payment-history') {
        return <TenantPaymentHistory />;
      }
      if (currentPage.type === 'tenant-maintenance') {
        return <TenantMaintenanceRequests onNavigate={navigateTo} />;
      }
      if (currentPage.type === 'neighbourhood-report') {
        return <NeighbourhoodReport onBack={() => setCurrentPage({ type: 'dashboard' })} />;
      }
      return <TenantDashboard onNavigate={navigateTo} />;
    }

    if (currentRole === 'landlord') {
      return <LandlordDashboard onNavigate={navigateTo} />;
    }

    if (currentRole === 'vendor') {
      if (currentPage.type === 'dashboard' || currentPage.type === 'vendor-jobs') {
        return <VendorDashboard onNavigate={navigateTo} />;
      }
      if (currentPage.type === 'vendor-invoices') {
        return <VendorDashboard onNavigate={navigateTo} />; // Can create separate invoices page later
      }
    }

    if (currentRole === 'admin') {
      if (currentPage.type === 'dashboard') return <AdminDashboard onNavigate={navigateTo} />;
      if (currentPage.type === 'reports') return <AdminReports />;
      return <AdminDashboard onNavigate={navigateTo} />;
    }

    // Manager role or generic content
    if (currentPage.type === 'dashboard') return <Dashboard onNavigate={navigateTo} />;
    if (currentPage.type === 'discover') return <PropertyDiscovery onNavigate={navigateTo} />;
    if (currentPage.type === 'tenants') return <TenantManagement onNavigate={navigateTo} />;
    if (currentPage.type === 'maintenance') return <MaintenanceBoard onNavigate={navigateTo} />;

    return <Dashboard onNavigate={navigateTo} />;
  };

  const getRoleDisplayName = () => {
    switch (currentRole) {
      case 'manager':
        return 'Property Manager';
      case 'tenant':
        return 'Tenant';
      case 'landlord':
        return 'Landlord';
      case 'vendor':
        return 'Service Provider';
      case 'admin':
        return 'System Admin';
      default:
        return 'User';
    }
  };

  return (
    <div className="flex size-full flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <button onClick={goHome} className="focus:outline-none">
            <Logo />
          </button>

          <div className="flex items-center gap-4">
            <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />
            <button className="relative rounded-lg p-2 hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <button className="rounded-lg p-2 hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
            <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  currentRole === 'manager'
                    ? 'bg-blue-600'
                    : currentRole === 'tenant'
                      ? 'bg-green-600'
                      : currentRole === 'landlord'
                        ? 'bg-purple-600'
                        : currentRole === 'vendor'
                          ? 'bg-orange-600'
                          : 'bg-red-600'
                }`}
              >
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">{auth.user ? auth.user.name : getRoleDisplayName()}</span>
            </button>
            <button
              onClick={async () => {
                await auth.logout();
                setIsAuthenticated(false);
                setShowLanding(true);
                setAuthScreen(null);
              }}
              title="Sign Out"
              className="flex items-center gap-1 rounded-lg p-2 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 bg-white p-4">
          {(currentRole === 'manager' || currentRole === 'landlord') && (
            <button
              onClick={() => setCurrentPage({ type: 'list-property' })}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-4 py-3 font-medium text-white hover:from-blue-700 hover:to-green-700"
            >
              <Plus className="h-5 w-5" />
              List Property
            </button>
          )}

          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentPage({ type: tab.id as any })}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    currentPage.type === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {currentRole !== 'admin' && currentRole !== 'vendor' && (
            <div className="mt-8 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 p-4">
              <h3 className="mb-2 text-sm font-semibold">AI Assistant</h3>
              <p className="mb-3 text-xs text-gray-600">
                {currentRole === 'tenant'
                  ? 'Get instant help with payments, maintenance, and lease questions'
                  : 'Get instant help with tenant queries, rent tracking, and more'}
              </p>
              <button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <MessageSquare className="h-4 w-4" />
                Open AI Chat
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{renderContent()}</main>

        {/* AI Assistant Sidebar */}
        {showAIAssistant && <AIAssistant onClose={() => setShowAIAssistant(false)} />}
      </div>
    </div>
  );
}
