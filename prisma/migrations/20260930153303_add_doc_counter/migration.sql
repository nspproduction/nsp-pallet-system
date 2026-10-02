-- CreateTable
CREATE TABLE "doc_counters" (
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_counters_pkey" PRIMARY KEY ("key")
);
