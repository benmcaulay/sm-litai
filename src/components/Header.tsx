
import { Button } from "@/components/ui/button";
import { Scale, User, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const { user, profile, firm, signOut } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-steel-blue-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/44fdde27-99ac-4c27-8f11-8ee90e1aa916.png"
                alt="Straus Meyers LLP Logo" 
                className="h-12 w-auto"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-steel-blue-600">
              <Scale className="h-4 w-4" />
              <span className="text-sm font-medium">Straus Meyers LLP</span>
            </div>

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-steel-blue-300 hover:bg-steel-blue-50">
                    <User className="h-4 w-4 mr-2" />
                    {profile?.role === 'admin' ? 'Admin' : 'User'}
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {profile?.role}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-steel-blue-200">
                  <DropdownMenuItem className="hover:bg-steel-blue-50">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-steel-blue-50">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="hover:bg-steel-blue-50 text-red-600"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
