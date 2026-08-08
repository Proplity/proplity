import { Building2, User, Home, Shield, Wrench } from 'lucide-react';

export type UserRole = 'manager' | 'tenant' | 'landlord' | 'admin' | 'vendor';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  const roles = [
    {
      id: 'manager' as UserRole,
      label: 'Property Manager',
      icon: Building2,
      color: 'blue',
    },
    { id: 'tenant' as UserRole, label: 'Tenant', icon: User, color: 'green' },
    {
      id: 'landlord' as UserRole,
      label: 'Landlord',
      icon: Home,
      color: 'purple',
    },
    {
      id: 'vendor' as UserRole,
      label: 'Service Provider',
      icon: Wrench,
      color: 'orange',
    },
    { id: 'admin' as UserRole, label: 'Admin', icon: Shield, color: 'red' },
  ];

  return (
    <div className="group relative">
      <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 hover:bg-gray-50">
        {roles.find((r) => r.id === currentRole)?.icon && (
          <>
            {(() => {
              const Icon = roles.find((r) => r.id === currentRole)!.icon;
              return <Icon className="h-4 w-4" />;
            })()}
          </>
        )}
        <span className="text-sm font-medium">
          {roles.find((r) => r.id === currentRole)?.label}
        </span>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="invisible absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        <div className="p-2">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Switch Role</p>
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => onRoleChange(role.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  currentRole === role.id
                    ? `bg-${role.color}-50 text-${role.color}-700`
                    : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    currentRole === role.id ? `bg-${role.color}-100` : 'bg-gray-100'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      currentRole === role.id ? `text-${role.color}-600` : 'text-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{role.label}</p>
                  {currentRole === role.id && <p className="text-xs text-gray-500">Current</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
