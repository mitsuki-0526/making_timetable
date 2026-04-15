import { useState } from "react";
import {
  Menu,
  Save,
  Download,
  FolderOpen,
  Table2,
  FileJson,
  BarChart3,
  Ruler,
  Settings,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import ConstraintsModal from "./components/ConstraintsModal";
import FileActions from "./components/FileActions";
import PdfExport from "./components/PdfExport";
import SettingsModal from "./components/SettingsModal";
import SolverPanel from "./components/SolverPanel";
import SubjectHoursChart from "./components/SubjectHoursChart";
import TeacherScheduleGrid from "./components/TeacherScheduleGrid";
import TimetableGrid from "./components/TimetableGrid";
import ValidationPanel from "./components/ValidationPanel";
import { useTimetableStore } from "./store/useTimetableStore";
import { ThemeToggle } from "./components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { Separator } from "@/components/ui/separator";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSolverOpen, setIsSolverOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const clearNonFixed = useTimetableStore((s) => s.clearNonFixed);

  const handleClearNonFixed = () => {
    if (
      window.confirm(
        "固定コマ以外のすべての教科・教員配置を削除します。よろしいですか？",
      )
    ) {
      clearNonFixed();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Toaster />

      {/* Modern Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4 gap-4">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:inline-flex">
                <Menu className="h-5 w-5" />
                <span className="sr-only">メニューを開く</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[300px] sm:w-[400px] overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  時間割作成メニュー
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4 py-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                    ファイル操作
                  </h3>
                  <FileActions>
                    {({
                      handleOverwriteSave,
                      handleSaveAs,
                      handleLoad,
                      handleExcelExport,
                      fileHandle,
                      fileName,
                    }) => (
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          className="justify-start gap-2"
                          onClick={() => {
                            handleOverwriteSave();
                            setIsMenuOpen(false);
                          }}
                          disabled={!fileHandle}
                        >
                          <Save className="h-4 w-4" />
                          上書き保存 {fileName && `(${fileName})`}
                        </Button>
                        <Button
                          variant="secondary"
                          className="justify-start gap-2"
                          onClick={() => {
                            handleSaveAs();
                            setIsMenuOpen(false);
                          }}
                        >
                          <Download className="h-4 w-4" />
                          名前を付けて保存
                        </Button>
                        <Button
                          variant="secondary"
                          className="justify-start gap-2"
                          onClick={() => {
                            handleLoad();
                            setIsMenuOpen(false);
                          }}
                        >
                          <FolderOpen className="h-4 w-4" />
                          ファイルを開く
                        </Button>
                        <Button
                          className="justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            handleExcelExport();
                            setIsMenuOpen(false);
                          }}
                        >
                          <Table2 className="h-4 w-4" />
                          Excel出力
                        </Button>
                      </div>
                    )}
                  </FileActions>

                  <PdfExport>
                    {({ open }) => (
                      <Button
                        variant="secondary"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          open();
                          setIsMenuOpen(false);
                        }}
                      >
                        <FileJson className="h-4 w-4 text-red-500" />
                        PDF出力
                      </Button>
                    )}
                  </PdfExport>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                    ツール
                  </h3>
                  <Button
                    variant="default"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setIsSolverOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    AI自動生成
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => {
                      handleClearNonFixed();
                      setIsMenuOpen(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    配置をリセット
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setIsChartOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    コマ数確認
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                    設定
                  </h3>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setIsConstraintsOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <Ruler className="h-4 w-4 text-orange-500" />
                    作成条件の設定
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    マスタデータの編集
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              時間割作成ツール
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <section className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <TimetableGrid />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <ValidationPanel />
        </section>

        <section className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <TeacherScheduleGrid />
        </section>
      </main>

      {/* Modals (Pending Dialog Refactoring) */}
      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {isConstraintsOpen && (
        <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />
      )}
      {isChartOpen && (
        <SubjectHoursChart onClose={() => setIsChartOpen(false)} />
      )}
      {isSolverOpen && <SolverPanel onClose={() => setIsSolverOpen(false)} />}
    </div>
  );
}
export default App;
