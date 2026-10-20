CREATE TABLE "request_attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "request_attachments_requestId_idx" ON "request_attachments"("requestId");

ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
