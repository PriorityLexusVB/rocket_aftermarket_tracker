import { Search as SearchIcon } from 'lucide-react'

const Search = ({ className = '', size = 16, ...props }) => (
  <SearchIcon className={className} size={size} {...props} />
)

export default Search
