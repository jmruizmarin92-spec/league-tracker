"use client";

import { useActionState, useState } from "react";
import {
  addStoreAdminAction,
  removeStoreAdminAction,
  type ActionState,
} from "@/app/actions/stores";
import type { StoreAdmin, StoreRole } from "@/lib/stores";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RosterLabels = {
  noAdmins: string;
  roleOwner: string;
  roleAdmin: string;
  roleLabel: string;
  remove: string;
  addAdmin: string;
  addAdminPlaceholder: string;
  add: string;
  added: string;
};

// A store's owner/admin list with the add form (PL-17). `canManage` is for
// owners (add/remove admins), `canSetOwner` for site admins (they also pick
// the role and may remove owners). The RPCs enforce the same rules; the
// flags only decide what to render.
export function StoreRoster({
  storeId,
  slug,
  admins,
  users,
  canManage,
  canSetOwner,
  labels,
}: {
  storeId: string;
  slug: string;
  admins: StoreAdmin[];
  users: { id: string; display_name: string }[];
  canManage: boolean;
  canSetOwner: boolean;
  labels: RosterLabels;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addStoreAdminAction,
    {},
  );
  const [user, setUser] = useState("");
  const [role, setRole] = useState<StoreRole>("admin");

  return (
    <div className="flex flex-col gap-3">
      {admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.noAdmins}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {admins.map((a) => {
            const removable = canManage && (a.role !== "owner" || canSetOwner);
            return (
              <li
                key={a.user_id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{a.display_name}</span>
                  <Badge variant={a.role === "owner" ? "default" : "secondary"}>
                    {a.role === "owner" ? labels.roleOwner : labels.roleAdmin}
                  </Badge>
                </span>
                {removable && (
                  <form action={removeStoreAdminAction}>
                    <input type="hidden" name="store_id" value={storeId} />
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" variant="outline" size="sm">
                      {labels.remove}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{labels.addAdmin}</span>
          <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="store_id" value={storeId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="user_id" value={user} />
            <input type="hidden" name="role" value={role} />
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="sm:flex-1">
                <SelectValue placeholder={labels.addAdminPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canSetOwner && (
              <Select value={role} onValueChange={(v) => setRole(v as StoreRole)}>
                <SelectTrigger className="sm:w-40" aria-label={labels.roleLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{labels.roleAdmin}</SelectItem>
                  <SelectItem value="owner">{labels.roleOwner}</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button type="submit" disabled={!user || pending}>
              {labels.add}
            </Button>
          </form>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.ok && <p className="text-sm text-primary">{labels.added}</p>}
        </div>
      )}
    </div>
  );
}
