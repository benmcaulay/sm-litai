import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Moon, Sun, Monitor, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center">
            <SettingsIcon className="mr-2 h-5 w-5 text-steel-blue-600" />
            Firm Settings
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            Manage your firm's LitAI configuration and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4 text-steel-blue-600" />
              <Label className="text-steel-blue-800 font-medium">Appearance</Label>
            </div>
            <div className="pl-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-steel-blue-700">Theme</Label>
                  <p className="text-xs text-steel-blue-600">
                    Choose your preferred color scheme
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="h-8 px-3"
                  >
                    <Sun className="h-3 w-3 mr-1" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="h-8 px-3"
                  >
                    <Moon className="h-3 w-3 mr-1" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("system")}
                    className="h-8 px-3"
                  >
                    <Monitor className="h-3 w-3 mr-1" />
                    System
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Application Settings */}
          <div className="space-y-4">
            <Label className="text-steel-blue-800 font-medium">Application Preferences</Label>
            <div className="pl-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-steel-blue-700">Notifications</Label>
                  <p className="text-xs text-steel-blue-600">
                    Receive notifications for document generation status
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-steel-blue-700">Auto-save Templates</Label>
                  <p className="text-xs text-steel-blue-600">
                    Automatically save template changes as you work
                  </p>
                </div>
                <Switch
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Save Settings */}
          <div className="flex justify-end">
            <Button className="bg-primary hover:bg-primary/90">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;