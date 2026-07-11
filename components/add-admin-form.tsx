"use client";

import { useState } from "react";
import { addLeagueAdminAction } from "@/app/actions/leagues";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddAdminForm({
  leagueId,
  slug,
  users,
  labels,
}: {
  leagueId: string;
  slug: string;
  users: { id: string; display_name: string }[];
  labels: { placeholder: string; cta: string };
}) {
  const [user, setUser] = useState("");

  return (
    <form action={addLeagueAdminAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="user_id" value={user} />
      <Select value={user} onValueChange={setUser}>
        <SelectTrigger className="sm:flex-1">
          <SelectValue placeholder={labels.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={!user}>
        {labels.cta}
      </Button>
    </form>
  );
}
