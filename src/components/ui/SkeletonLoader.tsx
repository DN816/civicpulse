import React from 'react';
import Card from './Card';

export default function SkeletonLoader() {
  return (
    <div className="space-y-4 w-full">
      {[1, 2, 3].map(i => (
        <Card key={i} className="animate-pulse flex flex-col gap-3">
          <div className="flex justify-between">
            <div className="h-5 bg-zinc-200 rounded w-1/3"></div>
            <div className="h-5 bg-zinc-200 rounded-full w-16"></div>
          </div>
          <div className="h-4 bg-zinc-200 rounded w-1/4 mb-2"></div>
          <div className="h-px bg-zinc-100 w-full"></div>
          <div className="flex justify-between">
            <div className="h-4 bg-zinc-200 rounded w-1/4"></div>
            <div className="h-4 bg-zinc-200 rounded w-1/4"></div>
          </div>
        </Card>
      ))}
    </div>
  );
}
