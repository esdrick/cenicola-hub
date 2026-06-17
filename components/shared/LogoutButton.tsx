"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      className="text-gray-500 hover:text-gray-900"
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <>
          <LogOut size={15} className="mr-1.5" />
          Salir
        </>
      )}
    </Button>
  );
}
