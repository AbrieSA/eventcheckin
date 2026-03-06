import React from 'react';
import Input from '../../../components/ui/Input';


const SearchBar = ({ searchQuery, onSearchChange, resultCount }) => {
  return (
    <div className="relative">
      <div className="relative">
        <Input
          type="search"
          placeholder="Search participants by name or ID..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e?.target?.value)}
          className="pl-4 pr-4"
        />
      </div>
      {searchQuery && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-caption">
            Found {resultCount} {resultCount === 1 ? 'participant' : 'participants'}
          </p>
          <button
            onClick={() => onSearchChange('')}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-smooth"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchBar;