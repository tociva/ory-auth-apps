import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import Fuse from "fuse.js";
import { map, shareReplay } from "rxjs";

export type SearchEntry = {
  title: string;
  description: string;
  keywords: string[];
  url: string;
};

export type SearchIndex = {
  entries: readonly SearchEntry[];
  fuse: Fuse<SearchEntry>;
};

@Injectable({ providedIn: "root" })
export class SearchIndexService {
  private readonly http = inject(HttpClient);

  /** Loads and caches the search index once for the lifetime of the app. */
  readonly index$ = this.http.get<SearchEntry[]>("/assets/search/index.json").pipe(
    map(
      (entries): SearchIndex => ({
        entries,
        fuse: new Fuse(entries, {
          keys: [
            { name: "title", weight: 2 },
            { name: "keywords", weight: 1.5 },
            { name: "description", weight: 1 },
          ],
          threshold: 0.35,
          includeScore: false,
          ignoreLocation: true,
        }),
      }),
    ),
    shareReplay(1),
  );
}
