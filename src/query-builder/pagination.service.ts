/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { PaginationControls } from './query-builder.types';

@Injectable()
export class PaginationService {
  static readonly DEFAULT_PAGE_SIZE = 12;
  static readonly DEFAULT_MAX_PAGE_SIZE = 120;
  static readonly DEFAULT_PAGE = 1;

  private getOffset(limit: number, page: number): number {
    return (page - 1) * limit;
  }

  buildPaginationQuery(query: Record<string, any> = {}) {
    const limit = this.parseLimit(query.limit);
    const page = this.parsePage(query.page);
    return {
      skip: this.getOffset(limit, page),
      take: limit,
    };
  }

  buildPaginationControls(
    totalCount: number,
    originalUrl: string,
    query: Record<string, any> = {},
  ): PaginationControls {
    this.validateTotalCount(totalCount);
    const limit = this.parseLimit(query.limit);
    const page = this.parsePage(query.page);
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = this.ensurePageWithinBounds(page, totalPages);
    const baseUrl = this.extractBaseUrl(originalUrl);
    const { page: _, ...queryWithoutPage } = query;

    return {
      next: this.buildNextUrl(
        currentPage,
        totalPages,
        baseUrl,
        queryWithoutPage,
        limit,
      ),
      prev: this.buildPrevUrl(currentPage, baseUrl, queryWithoutPage, limit),
      currentPage,
      pageSize: limit,
      totalPages,
      totalCount,
    };
  }

  private parseLimit(limit: any): number {
    if (limit === undefined) {
      return PaginationService.DEFAULT_PAGE_SIZE;
    }
    const parsed = parseInt(String(limit), 10);
    if (
      !isNaN(parsed) &&
      parsed > 0 &&
      parsed <= PaginationService.DEFAULT_MAX_PAGE_SIZE
    ) {
      return parsed;
    }
    return PaginationService.DEFAULT_PAGE_SIZE;
  }

  private parsePage(page: any): number {
    if (page === undefined) {
      return PaginationService.DEFAULT_PAGE;
    }
    const parsed = parseInt(String(page), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    return PaginationService.DEFAULT_PAGE;
  }

  private validateTotalCount(totalCount: number): void {
    if (!Number.isInteger(totalCount) || totalCount < 0) {
      throw new Error('totalCount must be a non-negative integer');
    }
  }

  private ensurePageWithinBounds(page: number, totalPages: number): number {
    if (totalPages > 0 && page > totalPages) {
      return totalPages;
    }
    return page;
  }

  private extractBaseUrl(originalUrl: string): string {
    return originalUrl.split('?')[0] || '';
  }

  private buildNextUrl(
    currentPage: number,
    totalPages: number,
    baseUrl: string,
    queryWithoutPage: Record<string, any>,
    limit: number,
  ): string | null {
    if (currentPage < totalPages) {
      const nextQuery = { ...queryWithoutPage, page: currentPage + 1, limit };
      const searchParams = new URLSearchParams();
      Object.entries(nextQuery).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      return `${baseUrl}?${searchParams.toString()}`;
    }
    return null;
  }

  private buildPrevUrl(
    currentPage: number,
    baseUrl: string,
    queryWithoutPage: Record<string, any>,
    limit: number,
  ): string | null {
    if (currentPage > 1) {
      const prevQuery = { ...queryWithoutPage, page: currentPage - 1, limit };
      const searchParams = new URLSearchParams();
      Object.entries(prevQuery).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      return `${baseUrl}?${searchParams.toString()}`;
    }
    return null;
  }
}
