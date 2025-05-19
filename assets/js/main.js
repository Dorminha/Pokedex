// -------------------------
// --- CONFIGURAÇÕES E CONSTANTES ---
// -------------------------
const POKE_API_BASE_URL = 'https://pokeapi.co/api/v2/pokemon';
const POKEMON_PER_PAGE = 20;

// -------------------------
// --- ELEMENTOS DO DOM ---
// -------------------------
const pokedexDisplay = document.getElementById('pokedexDisplay');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const pageInfo = document.getElementById('pageInfo');
const currentYearSpan = document.getElementById('currentYear');

// -------------------------
// --- ESTADO DA APLICAÇÃO ---
// -------------------------
let currentOffset = 0;
let currentPage = 1;
let totalPokemons = 0; // Será atualizado pela API na primeira carga

// -------------------------
// --- FUNÇÕES DE API ---
// -------------------------
const fetchJson = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Se o status for 404, é um erro esperado para Pokémon não encontrado
            if (response.status === 404) return null;
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Falha ao buscar dados da API:", error);
        displayFeedbackMessage('Falha ao carregar dados. Verifique sua conexão ou tente mais tarde.', 'error');
        return null;
    }
};

const fetchPokemonList = async (limit = POKEMON_PER_PAGE, offset = 0) => {
    return fetchJson(`${POKE_API_BASE_URL}?limit=${limit}&offset=${offset}`);
};

const fetchPokemonDetailsByNameOrId = async (nameOrId) => {
    return fetchJson(`${POKE_API_BASE_URL}/${nameOrId.toString().toLowerCase()}`);
};

const fetchFullPokemonDetails = async (pokemonListItem) => {
    // A lista inicial já traz a URL para detalhes, que é mais completa.
    return fetchJson(pokemonListItem.url);
};

// -------------------------
// --- MANIPULAÇÃO DO DOM E CRIAÇÃO DE CARDS ---
// -------------------------
const createPokemonCard = (pokemon) => {
    const card = document.createElement('article');
    card.className = 'pokemon-card';
    card.tabIndex = 0; // Torna o card focável
    card.setAttribute('aria-labelledby', `pokemon-name-${pokemon.id}`);
    card.setAttribute('role', 'listitem'); // Embora o pai não seja ul/ol, indica item de uma coleção

    const name = pokemon.name;
    const id = pokemon.id.toString().padStart(3, '0');
    const imageUrl = pokemon.sprites?.other?.['official-artwork']?.front_default ||
                     pokemon.sprites?.front_default ||
                     './assets/images/pokeball_placeholder.png'; // Crie uma imagem placeholder

    const types = pokemon.types.map(typeInfo =>
        `<span class="pokemon-card__type type--${typeInfo.type.name}">${typeInfo.type.name}</span>`
    ).join('');

    card.innerHTML = `
        <div class="pokemon-card__image-container">
            <img src="${imageUrl}" alt="Imagem de ${name}" class="pokemon-card__image" loading="lazy">
        </div>
        <p class="pokemon-card__id">#${id}</p>
        <h2 id="pokemon-name-${pokemon.id}" class="pokemon-card__name">${name}</h2>
        <div class="pokemon-card__types">
            ${types}
        </div>
    `;
    card.addEventListener('click', () => showPokemonDetailsModal(pokemon));
    card.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            showPokemonDetailsModal(pokemon);
        }
    });
    return card;
};

const displayPokemonsOnPage = (pokemonDataList) => {
    pokedexDisplay.innerHTML = ''; // Limpa display anterior ou mensagem de carregamento
    if (!pokemonDataList || pokemonDataList.length === 0) {
        displayFeedbackMessage('Nenhum Pokémon encontrado com esses critérios.', 'info');
        return;
    }
    pokemonDataList.forEach(pokemonData => {
        if (pokemonData) { // Verifica se o pokemonData não é null (ex: falha em uma das promises)
            const card = createPokemonCard(pokemonData);
            pokedexDisplay.appendChild(card);
        }
    });
};

const displaySinglePokemon = (pokemonData) => {
    pokedexDisplay.innerHTML = '';
    if (!pokemonData) {
        displayFeedbackMessage('Pokémon não encontrado.', 'error');
        togglePaginationVisibility(false); // Esconder paginação na busca sem resultado
        return;
    }
    const card = createPokemonCard(pokemonData);
    pokedexDisplay.appendChild(card);
    togglePaginationVisibility(false); // Esconder paginação ao exibir um único Pokémon
};

const displayFeedbackMessage = (message, type = 'loading' | 'error' | 'info') => {
    pokedexDisplay.innerHTML = `<p class="feedback-message feedback-message--${type}">${message}</p>`;
};

// -------------------------
// --- LÓGICA DE PAGINAÇÃO E BUSCA ---
// -------------------------
const updatePaginationControls = () => {
    const totalPages = Math.ceil(totalPokemons / POKEMON_PER_PAGE);
    pageInfo.textContent = `Página ${currentPage} de ${totalPages > 0 ? totalPages : 1}`;
    pageInfo.setAttribute('aria-label', `Página ${currentPage} de ${totalPages > 0 ? totalPages : 1}`);

    prevButton.disabled = currentOffset === 0;
    nextButton.disabled = (currentOffset + POKEMON_PER_PAGE) >= totalPokemons;

    togglePaginationVisibility(totalPages > 1 || (totalPages === 1 && currentPage === 1 && !searchInput.value));
};

const togglePaginationVisibility = (show) => {
    const displayStyle = show ? 'flex' : 'none'; // 'flex' para .pagination
    if (prevButton.parentElement) { // Verifica se o elemento pai existe
      prevButton.parentElement.style.display = displayStyle;
    }
};

const loadPokemonsForCurrentPage = async () => {
    displayFeedbackMessage('Carregando Pokémon...', 'loading');
    const listData = await fetchPokemonList(POKEMON_PER_PAGE, currentOffset);

    if (listData) {
        if (totalPokemons === 0) totalPokemons = listData.count; // Atualiza total na primeira carga

        // Busca os detalhes de cada Pokémon da lista
        const pokemonDetailPromises = listData.results.map(p => fetchFullPokemonDetails(p));
        const detailedPokemons = await Promise.all(pokemonDetailPromises);

        displayPokemonsOnPage(detailedPokemons.filter(p => p)); // Filtra nulos caso alguma promise falhe
        updatePaginationControls();
    } else {
        displayFeedbackMessage('Não foi possível carregar a lista de Pokémon.', 'error');
        togglePaginationVisibility(false); // Esconde paginação se houver erro
    }
};

const handleSearch = async () => {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        // Se a busca estiver vazia, recarrega a lista inicial
        currentOffset = 0;
        currentPage = 1;
        await loadPokemonsForCurrentPage();
        return;
    }

    displayFeedbackMessage(`Buscando por "${searchTerm}"...`, 'loading');
    const pokemon = await fetchPokemonDetailsByNameOrId(searchTerm);
    displaySinglePokemon(pokemon);
    // Não precisa chamar updatePaginationControls aqui, pois displaySinglePokemon já esconde.
};

// -------------------------
// --- MODAL DE DETALHES (SIMPLES) ---
// -------------------------
const showPokemonDetailsModal = (pokemon) => {
    // Esta é uma implementação de modal muito simples via alert.
    // Para um modal real, você criaria elementos HTML e os estilizaría com CSS.
    const details = `
        Nome: ${pokemon.name}
        ID: ${pokemon.id}
        Altura: ${pokemon.height / 10} m
        Peso: ${pokemon.weight / 10} kg
        Tipos: ${pokemon.types.map(t => t.type.name).join(', ')}
        Habilidades: ${pokemon.abilities.map(a => a.ability.name).join(', ')}
    `.trim().replace(/^ +/gm, ''); // Limpa espaços extras para o alert

    alert(details);
    console.log("Detalhes Completos:", pokemon); // Para ver no console o objeto completo
};


// -------------------------
// --- INICIALIZAÇÃO E EVENT LISTENERS ---
// -------------------------
const initializeApp = () => {
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

    nextButton.addEventListener('click', () => {
        if ((currentOffset + POKEMON_PER_PAGE) < totalPokemons) {
            currentOffset += POKEMON_PER_PAGE;
            currentPage++;
            loadPokemonsForCurrentPage();
        }
    });

    prevButton.addEventListener('click', () => {
        if (currentOffset > 0) {
            currentOffset -= POKEMON_PER_PAGE;
            currentPage--;
            loadPokemonsForCurrentPage();
        }
    });

    loadPokemonsForCurrentPage(); // Carregamento inicial
};

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initializeApp);