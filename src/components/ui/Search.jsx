import SearchIcon from 'lucide-react/dist/esm/icons/search.js'
const Search = ({ className = '', size = 16, ...props }) => (
  <SearchIcon className={className} size={size} {...props} />
)

export default Search
