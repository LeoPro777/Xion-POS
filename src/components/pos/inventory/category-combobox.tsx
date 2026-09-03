import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useInfiniteCategoriesQuery, useCategoryQuery } from "@/hooks/queries/use-inventory";

export function CategoryCombobox({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteCategoriesQuery(debouncedSearch);

  const categories = data?.pages.flatMap((p) => p.items) || [];
  const { data: categoryData } = useCategoryQuery(value);
  const selectedCategory = categories.find((c) => c.id === value) || categoryData;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value ? selectedCategory?.name || "Categoría Seleccionada" : "Seleccionar Categoría..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar categoría..." 
            value={search} 
            onValueChange={setSearch} 
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No se encontraron categorías.</CommandEmpty>
            <CommandGroup>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.id}
                  onSelect={() => {
                    onChange(category.id === value ? "" : category.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate">{category.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{category.full_path}</span>
                  </div>
                </CommandItem>
              ))}
              
              {hasNextPage && (
                <CommandItem
                  onSelect={(currentValue) => {
                    fetchNextPage();
                  }}
                  className="justify-center cursor-pointer text-sm text-primary"
                >
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar más..."}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
