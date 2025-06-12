" Enigma Tailwind CSS Optimizer configuration
let g:enigma_enabled = 1
let g:enigma_auto_optimize = 1
let g:enigma_show_diagnostics = 1
let g:enigma_language_server_port = 3003

" File type associations
autocmd BufNewFile,BufRead .enigmarc setfiletype json
autocmd BufNewFile,BufRead enigma.config.* setfiletype javascript

" Commands
command! EnigmaOptimize !npx enigma optimize
command! EnigmaWatch !npx enigma watch &

" Key mappings
nnoremap <leader>eo :EnigmaOptimize<CR>
nnoremap <leader>ew :EnigmaWatch<CR>