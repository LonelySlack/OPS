'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Don't render anything if there's only 1 page
  if (totalPages <= 1) return null

  // Helper to generate the page numbers array (e.g., [1, 2, 3, '...', 15])
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    
    // Logic to mimic your screenshot: always show first few, last one, and ellipsis
    if (totalPages <= 7) {
      // If 7 or fewer pages, show all: [1, 2, 3, 4, 5, 6, 7]
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Logic for many pages
      if (currentPage <= 4) {
        // Near start: [1, 2, 3, 4, 5, '...', 15]
        pages.push(1, 2, 3, 4, 5, '...', totalPages)
      } else if (currentPage >= totalPages - 3) {
        // Near end: [1, '...', 11, 12, 13, 14, 15]
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        // Middle: [1, '...', 4, 5, 6, '...', 15]
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }
    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2 mt-8 mb-12">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        <React.Fragment key={index}>
          {page === '...' ? (
            <span className="text-slate-400 px-2">...</span>
          ) : (
            <button
              onClick={() => onPageChange(page as number)}
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                currentPage === page
                  ? 'bg-slate-900 text-white shadow-md' // Active Style (Dark Circle)
                  : 'text-slate-600 hover:bg-slate-100' // Inactive Style
              )}
            >
              {page}
            </button>
          )}
        </React.Fragment>
      ))}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  )
}