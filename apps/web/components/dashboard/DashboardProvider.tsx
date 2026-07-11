"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ImageDetailsModal } from "@/components/dashboard/ImageDetailsModal";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useUpload } from "@/hooks/useUpload";

type DashboardContextValue = {
  session: ReturnType<typeof useDashboardSession>;
  upload: ReturnType<typeof useUpload>;
  dashboardItems: ReturnType<typeof useUpload>["history"];
  visibleActiveItem: ReturnType<typeof useUpload>["result"];
  visibleMetadata: ReturnType<typeof useUpload>["metadata"];
  historyFilter: string;
  setHistoryFilter: (term: string) => void;
  setDetailsOpen: (open: boolean) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const session = useDashboardSession();
  const upload = useUpload({
    ownerUserId: session.user?.id,
    guestSessionId: session.user ? undefined : session.guestSessionId,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const currentUserId = session.user?.id ?? null;
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  const dashboardItems = useMemo(
    () =>
      session.user
        ? upload.history.filter((item) => getMediaOwner(item, upload.mediaOwners) === session.user?.id)
        : upload.history.filter((item) => item.guestSessionId === session.guestSessionId),
    [session.user, session.guestSessionId, upload.history, upload.mediaOwners]
  );

  const activeItem = upload.selectedHistoryItem ?? upload.result;
  const activeItemOwner = activeItem ? getMediaOwner(activeItem, upload.mediaOwners) : undefined;
  const activeItemGuestSessionId = activeItem?.guestSessionId;
  const activeItemVisible =
    !activeItem ||
    (session.user
      ? activeItemOwner === session.user.id
      : activeItemGuestSessionId === session.guestSessionId);
  const visibleActiveItem = activeItemVisible ? activeItem : null;
  const metadataOwner = upload.metadata
    ? upload.mediaOwners[upload.metadata.fileId]
    : undefined;
  const metadataGuestSessionId = upload.metadata?.guestSessionId;
  const visibleMetadata =
    !upload.metadata ||
    (session.user
      ? metadataOwner === session.user.id
      : metadataGuestSessionId === session.guestSessionId)
      ? upload.metadata
      : null;

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;

    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      upload.clearActiveMedia();
      setDetailsOpen(false);
      setHistoryFilter("");
    }

    previousUserIdRef.current = currentUserId;
    // The reset should run only when the auth identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  return (
    <DashboardContext.Provider
      value={{
        session,
        upload,
        dashboardItems,
        visibleActiveItem,
        visibleMetadata,
        historyFilter,
        setHistoryFilter,
        setDetailsOpen,
      }}
    >
      {children}
      <ImageDetailsModal
        open={detailsOpen}
        item={visibleActiveItem}
        onClose={() => setDetailsOpen(false)}
        onDelete={upload.deleteMediaItem}
        deleting={upload.deletingFileId === visibleActiveItem?.fileId}
        onReprocess={upload.reprocessMediaItem}
        reprocessing={upload.reprocessingFileId === visibleActiveItem?.fileId}
        favorite={upload.favoriteFileIds.includes(visibleActiveItem?.fileId || "")}
        onToggleFavorite={upload.toggleFavoriteItem}
      />
    </DashboardContext.Provider>
  );
}

function getMediaOwner(
  item: { fileId: string; ownerUserId?: string },
  mediaOwners: Record<string, string>
) {
  return item.ownerUserId || mediaOwners[item.fileId];
}

export function useDashboard() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }

  return context;
}
