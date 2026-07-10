"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

export type UploadStage =
  | "idle"
  | "selected"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

export type UploadMetadata = {
  fileId: string;
  key: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  mediaType?: "image" | "document" | "unknown";
  uploadedAt: string;
};

export type MediaLabel = {
  name?: string;
  confidence?: number;
};

export type DocumentInsights = {
  emails?: string[];
  phoneNumbers?: string[];
  dates?: string[];
  amounts?: string[];
  identifiers?: string[];
};

export type MediaResult = {
  fileId: string;
  ownerUserId?: string;
  bucket?: string;
  objectKey?: string;
  originalFileName?: string;
  status?: string;
  uploadedAt?: string;
  processedAt?: string;
  labels?: MediaLabel[];
  fileSize?: number;
  fileType?: string;
  mediaType?: "image" | "document" | "unknown";
  extractionStatus?: string;
  extractedText?: string;
  textPreview?: string;
  wordCount?: number;
  documentInsights?: DocumentInsights;
  errorMessage?: string;
};

type WebSocketMessage = {
  type?: string;
  payload?: MediaResult;
};

const FAVORITES_STORAGE_KEY = "mandvision.favoriteFileIds";
const MEDIA_OWNERS_STORAGE_KEY = "mandvision.mediaOwners";
const SUPPORTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function useUpload({ ownerUserId }: { ownerUserId?: string } = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [status, setStatus] = useState("Choose a JPG, PNG, PDF, DOC, or DOCX file to begin.");
  const [metadata, setMetadata] = useState<UploadMetadata | null>(null);
  const [result, setResult] = useState<MediaResult | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<MediaResult | null>(null);
  const [history, setHistory] = useState<MediaResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [reprocessingFileId, setReprocessingFileId] = useState<string | null>(null);
  const [reprocessingPending, setReprocessingPending] = useState(false);
  const [favoriteFileIds, setFavoriteFileIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsedFavorites = storedFavorites ? JSON.parse(storedFavorites) : [];

      if (!Array.isArray(parsedFavorites)) return [];

      return parsedFavorites.filter((fileId): fileId is string => typeof fileId === "string");
    } catch (error) {
      console.error("Could not load favorite files", error);
      return [];
    }
  });
  const [mediaOwners, setMediaOwners] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};

    try {
      const storedOwners = window.localStorage.getItem(MEDIA_OWNERS_STORAGE_KEY);
      const parsedOwners = storedOwners ? JSON.parse(storedOwners) : {};

      if (!parsedOwners || typeof parsedOwners !== "object" || Array.isArray(parsedOwners)) {
        return {};
      }

      return Object.fromEntries(
        Object.entries(parsedOwners).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === "string" && typeof entry[1] === "string"
        )
      );
    } catch (error) {
      console.error("Could not load media ownership", error);
      return {};
    }
  });
  const activeFileIdRef = useRef<string | null>(null);

  const progressLabel = useMemo(() => {
    if (stage === "complete") return "Upload Complete";
    if (stage === "processing") return "Processing";
    if (stage === "uploading") return "Uploading";
    if (stage === "error") return "Needs Attention";
    if (stage === "selected") return "Ready to Upload";
    return "Ready";
  }, [stage]);

  useEffect(() => {
    void fetchHistory();
  }, []);

  useEffect(() => {
    const hasPendingItems = history.some((item) => isPendingMediaItem(item));

    if (!hasPendingItems) return;

    const intervalId = window.setInterval(() => {
      void fetchHistory({ silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [history]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteFileIds));
    } catch (error) {
      console.error("Could not save favorite files", error);
    }
  }, [favoriteFileIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MEDIA_OWNERS_STORAGE_KEY, JSON.stringify(mediaOwners));
    } catch (error) {
      console.error("Could not save media ownership", error);
    }
  }, [mediaOwners]);

  useEffect(() => {
    const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

    if (!websocketUrl) {
      console.warn("NEXT_PUBLIC_WEBSOCKET_URL is not configured.");
      return;
    }

    const socket = new WebSocket(websocketUrl);

    socket.onopen = () => {
      console.log("MandVision WebSocket connected.");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type !== "MEDIA_PROCESSED" || !message.payload) {
          return;
        }

        const activeFileId = activeFileIdRef.current;

        if (activeFileId && message.payload.fileId !== activeFileId) {
          setHistory((currentHistory) => upsertHistoryItem(currentHistory, message.payload!));
          return;
        }

        setResult(message.payload);
        setHistory((currentHistory) => upsertHistoryItem(currentHistory, message.payload!));
        setStage("complete");
        setStatus("Processing complete. Rekognition labels received in real time.");
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    };

    socket.onerror = (error) => {
      console.error("MandVision WebSocket error", error);
    };

    socket.onclose = () => {
      console.log("MandVision WebSocket disconnected.");
    };

    return () => {
      socket.close();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setMetadata(null);
    setResult(null);
    setFetchingPreview(false);
    setSelectedHistoryItem(null);

    activeFileIdRef.current = null;

    if (!selectedFile) {
      setPreviewUrl(null);
      setStage("idle");
      setStatus("Choose a JPG, PNG, PDF, DOC, or DOCX file to begin.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(selectedFile.type.startsWith("image/") ? URL.createObjectURL(selectedFile) : null);
    setStage("selected");
    setStatus(
      selectedFile.type.startsWith("image/")
        ? "Image selected. Ready for secure upload."
        : "Document selected. Ready for secure upload."
    );
  }

  async function handleUpload() {
    if (!file) {
      setStatus("Please select a file first.");
      setStage("error");
      return;
    }

    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      setStatus("Unsupported format. Please upload a JPG, PNG, PDF, DOC, or DOCX file.");
      setStage("error");
      return;
    }

    try {
      setUploading(true);
      setStage("uploading");
      setStatus("Requesting secure upload URL...");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }

      const presignResponse = await fetch(`${apiUrl}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          ownerUserId,
        }),
      });

      if (!presignResponse.ok) throw new Error("Could not get upload URL");

      const { uploadUrl, fileId, key } = await presignResponse.json();
      activeFileIdRef.current = fileId;
      setSelectedHistoryItem(null);
      setFetchingPreview(false);

      if (ownerUserId) {
        setMediaOwners((currentOwners) => ({
          ...currentOwners,
          [fileId]: ownerUserId,
        }));
      }

      setStatus("Uploading file directly to S3...");

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const uploadedAt = new Date().toISOString();

      setMetadata({
        fileId,
        key,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        mediaType: getMediaType(file.type),
        uploadedAt,
      });

      setStage("processing");
      setStatus(
        file.type.startsWith("image/")
          ? "Upload complete. MandVision is processing your image with Rekognition."
          : "Upload complete. MandVision is extracting document text."
      );

      void pollForResults(fileId);
    } catch (error) {
      console.error(error);
      setStage("error");
      setStatus("Something went wrong during upload. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function selectHistoryItem(item: MediaResult) {
    activeFileIdRef.current = item.fileId;
    setSelectedHistoryItem(item);
    setPreviewUrl(null);
    setFetchingPreview(true);
    setResult(item);
    setMetadata({
      fileId: item.fileId,
      key: item.objectKey || "",
      fileName: item.originalFileName || item.fileId,
      fileSize: item.fileSize || 0,
      fileType: item.fileType,
      mediaType: item.mediaType,
      uploadedAt: item.uploadedAt || item.processedAt || new Date().toISOString(),
    });
    setStage(
      item.status === "PROCESSED" || item.status === "DOCUMENT_PENDING"
        ? "complete"
        : item.status === "FAILED"
        ? "error"
        : "processing"
    );
    setStatus(
      item.mediaType === "document" && item.status === "PROCESSED"
        ? "Loaded previous document result from upload history."
        : item.status === "PROCESSED"
        ? "Loaded previous processed result from upload history. Fetching preview image..."
        : item.status === "DOCUMENT_PENDING"
        ? "Document uploaded. Text extraction is not available for this file type yet."
        : item.status === "FAILED"
        ? item.errorMessage || "This upload could not be processed."
        : "Loaded previous upload from history. Processing may still be pending."
    );

    await fetchPreviewUrl(item.fileId);
  }

  async function fetchPreviewUrl(fileId: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setFetchingPreview(false);
        return;
      }

      const response = await fetch(`${apiUrl}/media/${fileId}/preview-url`);

      if (!response.ok) {
        setPreviewUrl(null);
        setFetchingPreview(false);
        setStatus("Loaded history item, but preview image could not be loaded.");
        return;
      }

      const data = (await response.json()) as { previewUrl?: string };

      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setFetchingPreview(false);
        setStatus("Loaded previous processed result and preview image from history.");
      }

      if (!data.previewUrl) {
        setFetchingPreview(false);
      }
    } catch (error) {
      console.error("Could not fetch preview URL", error);
      setPreviewUrl(null);
      setFetchingPreview(false);
      setStatus("Loaded history item, but preview image could not be loaded.");
    }
  }

  async function fetchHistory({ silent = false }: { silent?: boolean } = {}) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) return;

      if (!silent) {
        setRefreshingHistory(true);
      }

      const response = await fetch(`${apiUrl}/media/`);

      if (!response.ok) return;

      const data = (await response.json()) as { items?: MediaResult[] };
      const nextHistory = data.items || [];
      setHistory(nextHistory);

      const activeFileId = activeFileIdRef.current;

      if (activeFileId) {
        const nextActiveItem = nextHistory.find((item) => item.fileId === activeFileId);

        if (nextActiveItem) {
          setResult(nextActiveItem);
          setSelectedHistoryItem((currentItem) =>
            currentItem?.fileId === activeFileId ? nextActiveItem : currentItem
          );

          if (nextActiveItem.mediaType === "document" && nextActiveItem.status === "PROCESSED") {
            setStage("complete");
            setStatus("Document text extraction complete.");
          } else if (nextActiveItem.status === "PROCESSED") {
            setStage("complete");
            setStatus("Processing complete. Rekognition labels are ready.");
          }

          if (nextActiveItem.status === "DOCUMENT_PENDING") {
            setStage("complete");
            setStatus("Document uploaded. Text extraction is not available for this file type yet.");
          }

          if (nextActiveItem.status === "FAILED") {
            setStage("error");
            setStatus(nextActiveItem.errorMessage || "This upload could not be processed.");
          }
        }
      }
    } catch (error) {
      console.error("Could not fetch upload history", error);
    } finally {
      if (!silent) {
        setRefreshingHistory(false);
      }
    }
  }

  async function deleteMediaItem(item: MediaResult) {
    const displayName = item.originalFileName || item.fileId;
    const confirmed = window.confirm(
      `Delete ${displayName}? This removes the file from storage and history.`
    );

    if (!confirmed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }

      setDeletingFileId(item.fileId);
      setStatus(`Deleting ${displayName}...`);

      const response = await fetch(`${apiUrl}/media/${item.fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete media item");
      }

      setHistory((currentHistory) =>
        currentHistory.filter((historyItem) => historyItem.fileId !== item.fileId)
      );
      setMediaOwners((currentOwners) => {
        const nextOwners = { ...currentOwners };
        delete nextOwners[item.fileId];
        return nextOwners;
      });
      setFavoriteFileIds((currentFavorites) =>
        currentFavorites.filter((fileId) => fileId !== item.fileId)
      );

      const isActiveItem =
        selectedHistoryItem?.fileId === item.fileId ||
        result?.fileId === item.fileId ||
        metadata?.fileId === item.fileId ||
        activeFileIdRef.current === item.fileId;

      if (isActiveItem) {
        activeFileIdRef.current = null;
        setSelectedHistoryItem(null);
        setResult(null);
        setMetadata(null);
        setPreviewUrl(null);
        setFetchingPreview(false);
        setStage("idle");
      }

      setStatus(`${displayName} was deleted from MandVision.`);
    } catch (error) {
      console.error("Could not delete media item", error);
      setStage("error");
      setStatus(
        error instanceof TypeError
          ? "Delete is not available on the deployed API yet. Deploy MandImageApiStack, then try again."
          : "Could not delete this file. Please try again."
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  async function reprocessMediaItem(item: MediaResult) {
    const displayName = item.originalFileName || item.fileId;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }

      setReprocessingFileId(item.fileId);
      setStatus(`Reprocessing ${displayName}...`);

      const response = await fetch(`${apiUrl}/media/${item.fileId}/reprocess`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not reprocess media item");
      }

      const mediaResult = (await response.json()) as MediaResult;

      setHistory((currentHistory) =>
        upsertHistoryItem(
          currentHistory.filter((historyItem) => historyItem.fileId !== item.fileId),
          mediaResult
        )
      );
      setResult(mediaResult);
      setSelectedHistoryItem(mediaResult);
      activeFileIdRef.current = mediaResult.fileId;

      if (mediaResult.status === "PROCESSED") {
        setStage("complete");
        setStatus("Reprocessing complete. Rekognition labels are ready.");
        return;
      }

      if (mediaResult.status === "FAILED") {
        setStage("error");
        setStatus(mediaResult.errorMessage || "This upload could not be reprocessed.");
        return;
      }

      setStage("processing");
      setStatus("Reprocess request was accepted.");
    } catch (error) {
      console.error("Could not reprocess media item", error);
      setStage("error");
      setStatus("Could not reprocess this file. Please try again.");
    } finally {
      setReprocessingFileId(null);
    }
  }

  async function reprocessPendingItems(items: MediaResult[] = history) {
    const pendingItems = items.filter((item) => isPendingMediaItem(item));

    if (!pendingItems.length) {
      setStatus("No pending uploads need reprocessing.");
      return;
    }

    try {
      setReprocessingPending(true);
      setStatus(`Reprocessing ${pendingItems.length} pending upload${pendingItems.length === 1 ? "" : "s"}...`);

      for (const item of pendingItems) {
        await reprocessMediaItem(item);
      }

      await fetchHistory({ silent: true });
      setStatus(`Reprocess request finished for ${pendingItems.length} pending upload${pendingItems.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Could not reprocess pending media items", error);
      setStage("error");
      setStatus("Could not reprocess all pending uploads. Please try again.");
    } finally {
      setReprocessingPending(false);
    }
  }

  async function pollForResults(fileId: string) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setStage("error");
      setStatus("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    for (let attempt = 1; attempt <= 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await fetch(`${apiUrl}/media/${fileId}`);

      if (response.ok) {
        const mediaResult = (await response.json()) as MediaResult;
        setResult(mediaResult);
        setHistory((currentHistory) => upsertHistoryItem(currentHistory, mediaResult));

        if (mediaResult.mediaType === "document" && mediaResult.status === "PROCESSED") {
          setStage("complete");
          setStatus("Document text extraction complete.");
          return;
        }

        if (mediaResult.status === "PROCESSED") {
          setStage("complete");
          setStatus("Processing complete. Rekognition labels are ready.");
          return;
        }

        if (mediaResult.status === "DOCUMENT_PENDING") {
          setStage("complete");
          setStatus("Document uploaded. Text extraction is not available for this file type yet.");
          return;
        }

        if (mediaResult.status === "FAILED") {
          setStage("error");
          setStatus(mediaResult.errorMessage || "This upload could not be processed.");
          return;
        }
      }

      setStatus(`Processing file... checking results (${attempt}/8)`);
    }

    setStage("processing");
    setStatus("Still processing. Refresh or upload another file in a moment.");
  }

  function toggleFavoriteItem(item: MediaResult) {
    setFavoriteFileIds((currentFavorites) => {
      if (currentFavorites.includes(item.fileId)) {
        setStatus(`${item.originalFileName || item.fileId} removed from favorites.`);
        return currentFavorites.filter((fileId) => fileId !== item.fileId);
      }

      setStatus(`${item.originalFileName || item.fileId} added to favorites.`);
      return [item.fileId, ...currentFavorites];
    });
  }

  return {
    file,
    previewUrl,
    stage,
    status,
    metadata,
    result,
    history,
    mediaOwners,
    uploading,
    fetchingPreview,
    refreshingHistory,
    deletingFileId,
    reprocessingFileId,
    reprocessingPending,
    favoriteFileIds,
    progressLabel,
    handleFileChange,
    handleUpload,
    deleteMediaItem,
    reprocessMediaItem,
    reprocessPendingItems,
    toggleFavoriteItem,
    fetchHistory,
    fetchPreviewUrl,
    selectHistoryItem,
    selectedHistoryItem,
    setSelectedHistoryItem,
  };
}

function upsertHistoryItem(items: MediaResult[], nextItem: MediaResult) {
  const withoutDuplicate = items.filter((item) => item.fileId !== nextItem.fileId);
  return [nextItem, ...withoutDuplicate];
}

function isPendingMediaItem(item: MediaResult) {
  return (
    item.status !== "PROCESSED" &&
    item.status !== "FAILED" &&
    item.status !== "DOCUMENT_PENDING"
  );
}

function getMediaType(fileType: string): "image" | "document" | "unknown" {
  if (fileType.startsWith("image/")) return "image";
  if (
    fileType === "application/pdf" ||
    fileType === "application/msword" ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }

  return "unknown";
}
