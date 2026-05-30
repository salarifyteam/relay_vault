import type { CurrentDeveloper } from "@/lib/auth";
import type { TenantPickerItem } from "@/components/TenantPicker";

// 콘솔 페이지에서 Shell에 넘길 tenant/tenants/account를 한 줄로 만든다.
export function shellPropsFromMe(me: CurrentDeveloper) {
  const tenant: TenantPickerItem = {
    _id: String(me.tenant._id),
    name: me.tenant.name,
    role: me.role,
  };
  const tenants: TenantPickerItem[] = me.memberships.map((m) => ({
    _id: String(m._id),
    name: m.name,
    role: m.role,
  }));
  return {
    account: { name: me.account.name, email: me.account.email, picture: me.account.picture },
    tenant,
    tenants,
  };
}
