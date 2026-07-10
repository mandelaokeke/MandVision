"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
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
  const upload = useUpload({ ownerUserId: session.user?.id });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");

  const dashboardItems = useMemo(
    () =>
      session.user
        ? upload.history.filter(
            (item) => upload.mediaOwners[item.fileId] === session.user?.id
          )
        : upload.history,
    [session.user, upload.history, upload.mediaOwners]
  );

  const activeItem = upload.selectedHistoryItem ?? upload.result;
  const activeItemVisible =
    !activeItem ||
    !session.user ||
    upload.mediaOwners[activeItem.fileId] === session.user.id;
  const visibleActiveItem = activeItemVisible ? activeItem : null;
  const visibleMetadata =
    !upload.metadata ||
    !session.user ||
    upload.mediaOwners[upload.metadata.fileId] === session.user.id
      ? upload.metadata
      : null;

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

export function useDashboard() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used inside DashboardProvider");
  }

  return context;
}
