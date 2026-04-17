import { useState } from "react";
import { Menu } from "lucide-react";
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

      <header className="sticky top-0 z-40 w-full border-b border-border bg-background">
        <div className="mx-auto flex h-12 items-center gap-3 px-4">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-1"
                aria-label="メニューを開く"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[320px] overflow-y-auto p-0"
            >
              <SheetHeader className="border-b border-border px-5 py-3">
                <SheetTitle className="text-sm font-semibold text-foreground">
                  メニュー
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col px-2 py-3">
                <MenuSection label="ファイル">
                  <FileActions>
                    {({
                      handleOverwriteSave,
                      handleSaveAs,
                      handleLoad,
                      handleExcelExport,
                      fileHandle,
                      fileName,
                    }) => (
                      <>
                        <MenuItem
                          onClick={() => {
                            handleOverwriteSave();
                            setIsMenuOpen(false);
                          }}
                          disabled={!fileHandle}
                        >
                          上書き保存 {fileName ? `（${fileName}）` : ""}
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            handleSaveAs();
                            setIsMenuOpen(false);
                          }}
                        >
                          名前を付けて保存…
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            handleLoad();
                            setIsMenuOpen(false);
                          }}
                        >
                          開く…
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            handleExcelExport();
                            setIsMenuOpen(false);
                          }}
                        >
                          Excel 書き出し
                        </MenuItem>
                      </>
                    )}
                  </FileActions>
                  <PdfExport>
                    {({ open }) => (
                      <MenuItem
                        onClick={() => {
                          open();
                          setIsMenuOpen(false);
                        }}
                      >
                        PDF 書き出し
                      </MenuItem>
                    )}
                  </PdfExport>
                </MenuSection>

                <Separator className="my-2" />

                <MenuSection label="ツール">
                  <MenuItem
                    onClick={() => {
                      setIsSolverOpen(true);
                      setIsMenuOpen(false);
                    }}
                    emphasis
                  >
                    自動生成を実行
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setIsChartOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    教科コマ数を確認
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      handleClearNonFixed();
                      setIsMenuOpen(false);
                    }}
                    destructive
                  >
                    配置をすべてリセット
                  </MenuItem>
                </MenuSection>

                <Separator className="my-2" />

                <MenuSection label="設定">
                  <MenuItem
                    onClick={() => {
                      setIsConstraintsOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    作成条件を編集
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    マスタデータを編集
                  </MenuItem>
                </MenuSection>
              </nav>
            </SheetContent>
          </Sheet>

          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            時間割作成ツール
          </h1>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 space-y-4">
        <TimetableGrid />
        <ValidationPanel />
        <TeacherScheduleGrid />
      </main>

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

function MenuSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function MenuItem({
  onClick,
  disabled,
  emphasis,
  destructive,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm
        transition-colors
        enabled:hover:bg-accent
        disabled:cursor-not-allowed disabled:opacity-45
        ${emphasis ? "font-semibold text-foreground" : ""}
        ${destructive ? "text-destructive enabled:hover:bg-destructive/10" : ""}
      `}
    >
      {children}
    </button>
  );
}

export default App;
