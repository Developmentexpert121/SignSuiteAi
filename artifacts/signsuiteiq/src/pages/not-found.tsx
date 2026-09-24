import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F8FD] pt-20">
      <div className="text-center max-w-md mx-4">
        <h1 className="text-6xl font-bold text-[#0B1E3D] mb-4">404</h1>
        <p className="text-xl text-[#1A1A2E] mb-2">Page not found</p>
        <p className="text-[#64748B] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button className="bg-[#29ABE2] hover:bg-[#29ABE2]/90 text-white rounded-sm px-8 font-medium uppercase tracking-wide">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
