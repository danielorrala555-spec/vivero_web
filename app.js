'use strict';
const CATEGORIAS = ['Interior', 'Exterior', 'Suculentas y cactus', 'Ornamentales', 'Frutales', 'Aromáticas y medicinales', 'Otras'];
const $ = id => document.getElementById(id);
const escapar = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PAGE_SIZE = 8, ADMIN_SIZE = 15;
let paginaPublica = 0, paginaAdmin = 0, filtroPublico = '', busquedaPublica = '', filtroAdmin = '', busquedaAdmin = '', totalAdmin = 0, agotadoPublico = false;
let sesionAdmin = false, fotosQuitadas = new Set(), plantaEnEdicion = null;
const TIEMPO_INACTIVIDAD_ADMIN = 3 * 60 * 1000;
let temporizadorInactividadAdmin = null;

function detenerTemporizadorInactividadAdmin() {
    if (temporizadorInactividadAdmin !== null) {
        clearTimeout(temporizadorInactividadAdmin);
        temporizadorInactividadAdmin = null;
    }
}

function reiniciarTemporizadorInactividadAdmin() {
    if (!sesionAdmin) return;
    detenerTemporizadorInactividadAdmin();
    temporizadorInactividadAdmin = setTimeout(() => {
        cerrarSesionAdmin(true);
    }, TIEMPO_INACTIVIDAD_ADMIN);
}

async function cerrarSesionAdmin(porInactividad = false) {
    if (!sesionAdmin) return;
    detenerTemporizadorInactividadAdmin();

    // Desactivar primero el estado local para impedir acciones administrativas
    // mientras se cierra la sesión remota.
    sesionAdmin = false;
    cambioVistaEnCurso = false;
    document.body.classList.remove('admin-mode', 'admin-preview', 'admin-returning');
    $('volver-admin-flotante').hidden = true;
    $('admin-panel').hidden = true;
    $('planta-form').hidden = true;
    $('login-dialog').close();

    if (!MODO_DEMO) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.error('No se pudo cerrar la sesión administrativa:', error);
    }

    if (porInactividad) {
        alert('El panel de administración se cerró por 3 minutos de inactividad. Para volver a administrarlo, ingresa nuevamente.');
    }
}

// La actividad dentro del panel o de su vista previa mantiene abierta la sesión.
['pointerdown', 'pointermove', 'keydown', 'click', 'scroll', 'input', 'change', 'touchstart', 'wheel']
    .forEach(eventName => {
        window.addEventListener(eventName, () => {
            if (sesionAdmin) reiniciarTemporizadorInactividadAdmin();
        }, { passive: true });
    });
const DEMO_KEY = 'vivero-demo-v1';
const ejemplos = [
    { id: 1, codigo: 'PL-001', nombre: 'Monstera deliciosa', categoria: 'Interior', precio: 18, stock: 6, descripcion: 'Planta de hojas grandes, ideal para interiores luminosos.', fotos: [] },
    { id: 2, codigo: 'PL-002', nombre: 'Lavanda', categoria: 'Aromáticas y medicinales', precio: 5.5, stock: 12, descripcion: 'Planta aromática para espacios soleados.', fotos: [] },
    { id: 3, codigo: 'PL-003', nombre: 'Echeveria', categoria: 'Suculentas y cactus', precio: 4, stock: 0, descripcion: 'Suculenta ornamental de fácil cuidado.', fotos: [] }
];
let demo = (() => { try {
    return JSON.parse(localStorage.getItem(DEMO_KEY)) || { plantas: ejemplos, whatsapp: '' };
}
catch {
    return { plantas: ejemplos, whatsapp: '' };
} })();
const persistirDemo = () => localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
function llenarCategorias() { for (const id of ['categoria-publica', 'categoria-admin', 'planta-categoria']) {
    const select = $(id);
    select.innerHTML = (id === 'planta-categoria' ? '' : '<option value="">Todas las categorías</option>') + CATEGORIAS.map(c => `<option value="${escapar(c)}">${escapar(c)}</option>`).join('');
} }
function urlWhatsapp(numero, mensaje) { const n = String(numero || '').replace(/\D/g, ''); return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : ''; }
function numeroLocalEcuador(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (digitos.startsWith('593') && digitos.length === 12) return '0' + digitos.slice(3);
    if (digitos.startsWith('09') && digitos.length === 10) return digitos;
    if (digitos.startsWith('9') && digitos.length === 9) return '0' + digitos;
    return '';
}
function normalizarNumeroEcuador(local) {
    const digitos = String(local || '').replace(/\D/g, '');
    if (!/^09\d{8}$/.test(digitos)) throw Error('Ingresa un número ecuatoriano válido de 10 dígitos que comience por 09.');
    return '+593' + digitos.slice(1);
}
const REDES = {
    facebook: { dominio: 'facebook.com', etiqueta: 'Facebook', icono: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8z"/></svg>' },
    instagram: { dominio: 'instagram.com', etiqueta: 'Instagram', icono: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2"/></svg>' },
    tiktok: { dominio: 'tiktok.com', etiqueta: 'TikTok', icono: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3v11.1a4.1 4.1 0 1 1-3.5-4.05v3.2a1 1 0 1 0 .5.85V3h3c.2 2.1 1.4 3.5 3.5 3.8v3.1A7.1 7.1 0 0 1 15 8.5" /></svg>' }
};
function validarUrlRed(url, red) {
    const valor = String(url || '').trim();
    if (!valor) return '';
    let parsed;
    try { parsed = new URL(valor); } catch { throw Error(`El enlace de ${REDES[red].etiqueta} no es válido.`); }
    const host = parsed.hostname.toLowerCase();
    const dominio = REDES[red].dominio;
    if (parsed.protocol !== 'https:' || ![dominio, `www.${dominio}`].includes(host)) {
        throw Error(`Para ${REDES[red].etiqueta}, utiliza un enlace HTTPS de ${dominio}.`);
    }
    return parsed.href;
}
function mostrarRedes(redes = {}) {
    const contenedorSuperior = $('social-links');
    const contenedorInferior = $('social-links-footer');
    const enlacesSuperiores = [];
    const tarjetasInferiores = [];

    Object.entries(REDES).forEach(([clave, red]) => {
        if (!redes[clave]) return;
        try {
            const urlSegura = validarUrlRed(redes[clave], clave);
            enlacesSuperiores.push(
                `<a class="social-link" href="${escapar(urlSegura)}" target="_blank" rel="noopener noreferrer" aria-label="${red.etiqueta}" title="${red.etiqueta}">${red.icono}</a>`
            );
            tarjetasInferiores.push(
                `<a class="social-card social-card-${clave}" href="${escapar(urlSegura)}" target="_blank" rel="noopener noreferrer" aria-label="Visitar ${red.etiqueta}" title="${red.etiqueta}">${red.icono}<span>${red.etiqueta}</span></a>`
            );
        } catch (error) {
            console.warn(`Se omitió un enlace no válido de ${red.etiqueta}.`, error);
        }
    });

    contenedorSuperior.innerHTML = enlacesSuperiores.join('');
    contenedorSuperior.hidden = enlacesSuperiores.length === 0;

    contenedorInferior.innerHTML = tarjetasInferiores.join('');
    contenedorInferior.hidden = tarjetasInferiores.length === 0;
}
let contactoActual = { whatsapp: '', facebook: '', instagram: '', tiktok: '' };

async function obtenerContacto() {
    if (MODO_DEMO) return { whatsapp: demo.whatsapp, facebook: '', instagram: '', tiktok: '' };
    const { data, error } = await supabaseClient
        .from('configuracion')
        .select('whatsapp, facebook, instagram, tiktok')
        .eq('id', 1)
        .maybeSingle();
    if (error) throw error;
    return data || { whatsapp: '', facebook: '', instagram: '', tiktok: '' };
}
async function cargarContacto() {
    try {
        const datos = await obtenerContacto();
        contactoActual = {
            whatsapp: datos.whatsapp || '',
            facebook: datos.facebook || '',
            instagram: datos.instagram || '',
            tiktok: datos.tiktok || ''
        };
        const numero = contactoActual.whatsapp;
        const enlace = $('whatsapp-general');
        enlace.hidden = !numero;
        if (numero) enlace.href = urlWhatsapp(numero, 'Hola, quisiera consultar sobre sus plantas.');
        $('aviso-contacto').textContent = numero ? '' : 'El número de WhatsApp aún no está configurado.';
        mostrarRedes(datos);
        if (sesionAdmin) {
            $('numero-whatsapp').value = numeroLocalEcuador(numero);
            $('url-facebook').value = datos.facebook || '';
            $('url-instagram').value = datos.instagram || '';
            $('url-tiktok').value = datos.tiktok || '';
        }
    } catch (e) {
        $('aviso-contacto').textContent = 'No se pudo cargar el contacto.';
        console.error(e);
    }
}
function filtrarDemo(items, categoria, busqueda) { const q = busqueda.toLocaleLowerCase('es'); return items.filter(p => (!categoria || p.categoria === categoria) && (!q || `${p.nombre} ${p.codigo}`.toLocaleLowerCase('es').includes(q))).sort((a, b) => a.id - b.id); }
async function consultarPlantas({ pagina, tamano, categoria, busqueda }) { if (MODO_DEMO) {
    const lista = filtrarDemo(demo.plantas, categoria, busqueda);
    return { items: lista.slice(pagina * tamano, (pagina + 1) * tamano), total: lista.length };
} let q = supabaseClient.from('plantas').select('*', { count: 'exact' }).order('id', { ascending: true }); if (categoria)
    q = q.eq('categoria', categoria); if (busqueda) {
    const safe = busqueda.replace(/[%_,()]/g, ' ').trim();
    if (safe)
        q = q.or(`nombre.ilike.%${safe}%,codigo.ilike.%${safe}%`);
} const { data, error, count } = await q.range(pagina * tamano, (pagina + 1) * tamano - 1); if (error)
    throw error; return { items: data || [], total: count || 0 }; }
function tarjeta(p) {
    const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
    const disponible = Number(p.stock) > 0;
    const principal = fotos[0]
        ? `<button type="button" class="photo-thumb-button" data-ver-foto="${escapar(fotos[0])}" data-foto-titulo="${escapar(p.nombre)}" aria-label="Ampliar foto de ${escapar(p.nombre)}"><img src="${escapar(fotos[0])}" alt="${escapar(p.nombre)}" loading="lazy"></button>`
        : 'Fotografía próximamente';
    // La foto principal ya se muestra en la tarjeta; aquí solo van las adicionales.
    const fotosAdicionales = fotos.slice(1);
    const galeria = fotosAdicionales.map((src, i) =>
        `<button type="button" class="photo-thumb-button" data-ver-foto="${escapar(src)}" data-foto-titulo="${escapar(p.nombre)}" aria-label="Ampliar fotografía adicional ${i + 1} de ${escapar(p.nombre)}"><img src="${escapar(src)}" alt="Fotografía adicional ${i + 1} de ${escapar(p.nombre)}" loading="lazy"></button>`
    ).join('');
    return `<article class="plant-card"><div class="plant-photo">${principal}</div><div class="plant-body"><h3>${escapar(p.nombre)}</h3><p class="meta">${escapar(p.categoria)} · Stock: ${Number(p.stock)}</p><span class="status ${disponible ? '' : 'out'}">${disponible ? '● Disponible' : '● No disponible'}</span><button class="btn centered" data-expandir="${p.id}" aria-expanded="false">Ver más</button><div class="details"><p><strong>Precio:</strong> $${Number(p.precio).toFixed(2)}</p><p><strong>Código:</strong> ${escapar(p.codigo)}</p><p>${escapar(p.descripcion)}</p>${fotosAdicionales.length ? `<div class="thumbs" aria-label="Galería de ${escapar(p.nombre)}">${galeria}</div>` : '<p class="muted">Esta planta todavía no tiene fotografías adicionales.</p>'}${disponible ? `<button class="btn" data-consultar="${p.id}">Consultar por WhatsApp</button>` : ''}</div></div></article>`;
}
let plantasVisibles = [];
async function cargarPublico(reiniciar = true) { if (reiniciar) {
    paginaPublica = 0;
    plantasVisibles = [];
    $('plantas-grid').innerHTML = '';
} $('estado-publico').textContent = 'Cargando plantas…'; try {
    const { items, total } = await consultarPlantas({ pagina: paginaPublica, tamano: PAGE_SIZE, categoria: filtroPublico, busqueda: busquedaPublica });
    plantasVisibles.push(...items);
    $('plantas-grid').insertAdjacentHTML('beforeend', items.map(tarjeta).join(''));
    agotadoPublico = plantasVisibles.length >= total;
    $('ver-mas').hidden = agotadoPublico;
    $('estado-publico').textContent = total ? `${total} planta(s) encontrada(s).` : 'No hay plantas para estos filtros.';
}
catch (e) {
    $('estado-publico').textContent = 'No se pudieron cargar las plantas.';
    console.error(e);
} }
let visorGaleria = [];
let visorIndice = 0;
function actualizarVisorFotos() {
    if (!visorGaleria.length) return;
    const foto = visorGaleria[visorIndice];
    $('foto-ampliada').src = foto.url;
    $('foto-ampliada').alt = `Fotografía ${visorIndice + 1} de ${visorGaleria.length} de ${foto.titulo}`;
    $('foto-ampliada-titulo').textContent = foto.titulo;
    $('foto-ampliada-contador').textContent = `${visorIndice + 1} de ${visorGaleria.length}`;
    const hayVarias = visorGaleria.length > 1;
    $('foto-anterior').hidden = !hayVarias;
    $('foto-siguiente').hidden = !hayVarias;
}
$('foto-anterior').addEventListener('click', () => {
    if (visorGaleria.length < 2) return;
    visorIndice = (visorIndice - 1 + visorGaleria.length) % visorGaleria.length;
    actualizarVisorFotos();
});
$('foto-siguiente').addEventListener('click', () => {
    if (visorGaleria.length < 2) return;
    visorIndice = (visorIndice + 1) % visorGaleria.length;
    actualizarVisorFotos();
});
$('visor-fotos').addEventListener('close', () => {
    $('foto-ampliada').src = '';
    visorGaleria = [];
    visorIndice = 0;
});
$('plantas-grid').addEventListener('click', async (e) => {
    const foto = e.target.closest('[data-ver-foto]');
    if (foto) {
        // Si el visor ya estaba abierto, cerrarlo antes de cargar la nueva selección.
        // Así evitamos conservar la galería anterior al abrir otra fotografía.
        if ($('visor-fotos').open) $('visor-fotos').close();
        const tarjeta = foto.closest('.plant-card');
        const titulo = foto.dataset.fotoTitulo || 'la planta';
        const botonesFotos = tarjeta ? [...tarjeta.querySelectorAll('[data-ver-foto]')] : [foto];
        visorGaleria = botonesFotos.map(boton => ({
            url: boton.dataset.verFoto,
            titulo: boton.dataset.fotoTitulo || titulo
        }));
        visorIndice = Math.max(0, botonesFotos.indexOf(foto));
        actualizarVisorFotos();
        $('visor-fotos').showModal();
        return;
    }
    const expandir = e.target.closest('[data-expandir]');

if (expandir) {
    const detalles = expandir.nextElementSibling;
    const abrir = !detalles.classList.contains('is-open');

    // Cerrar cualquier otra tarjeta que esté abierta.
    document.querySelectorAll('#plantas-grid .details.is-open').forEach(detalleAbierto => {

        if (detalleAbierto === detalles) return;

        detalleAbierto.classList.remove('is-open');

        const botonAnterior = detalleAbierto.previousElementSibling;

        if (botonAnterior?.matches('[data-expandir]')) {
            botonAnterior.textContent = 'Ver más';
            botonAnterior.setAttribute('aria-expanded', 'false');
        }
    });

    // Abrir o cerrar la tarjeta seleccionada.
    detalles.classList.toggle('is-open', abrir);

    expandir.textContent = abrir ? 'Ver menos' : 'Ver más';

    expandir.setAttribute('aria-expanded', String(abrir));

    return;
}const boton = e.target.closest('[data-consultar]'); if (boton) {
    const p = plantasVisibles.find(x => String(x.id) === boton.dataset.consultar);
    if (!p)
        return;
    try {
        const contacto = await obtenerContacto();
        const url = urlWhatsapp(contacto?.whatsapp, `Hola, quisiera consultar por ${p.nombre} (${p.codigo}).`);
        if (url)
            window.open(url, '_blank', 'noopener,noreferrer');
        else
            alert('El vivero todavía no configuró su WhatsApp.');
    }
    catch {
        alert('No se pudo obtener el contacto.');
    }
} });
$('ver-mas').addEventListener('click', () => { if (!agotadoPublico) {
    paginaPublica++;
    cargarPublico(false);
} });
$('categoria-publica').addEventListener('change', e => { filtroPublico = e.target.value; cargarPublico(); });
let debounce;
$('buscar-publico').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => { busquedaPublica = e.target.value.trim(); cargarPublico(); }, 250); });
async function verificarAdmin() { if (MODO_DEMO)
    return false; const { data } = await supabaseClient.auth.getUser(); return Boolean(data?.user); }
let posicionAntesVistaPrevia = 0;
let cambioVistaEnCurso = false;

// Espera a que termine el desplazamiento suave (con respaldo para navegadores sin scrollend).
function desplazarSuavementeHasta(posicion) {
    return new Promise(resolve => {
        let terminado = false;
        let respaldo;

        const finalizar = () => {
            if (terminado) return;
            terminado = true;
            clearTimeout(respaldo);
            window.removeEventListener('scrollend', finalizar);
            resolve();
        };

        window.addEventListener('scrollend', finalizar, { once: true });
        respaldo = setTimeout(finalizar, 1800);
        window.scrollTo({ top: Math.max(0, posicion), behavior: 'smooth' });
    });
}

async function entrarVistaPrevia() {
    if (cambioVistaEnCurso || !sesionAdmin || $('admin-panel').hidden) return;

    cambioVistaEnCurso = true;
    posicionAntesVistaPrevia = window.scrollY;

    // Primero se revela la web pública y después se desplaza hasta su portada.
    document.body.classList.add('admin-preview');
    $('volver-admin-flotante').hidden = false;

    const portada = $('inicio');
    const destino = portada
        ? portada.getBoundingClientRect().top + window.scrollY
        : 0;

    await desplazarSuavementeHasta(destino);
    cambioVistaEnCurso = false;
}

async function salirVistaPrevia() {
    if (cambioVistaEnCurso || !document.body.classList.contains('admin-preview')) return;

    cambioVistaEnCurso = true;

    // Se hace visible el panel mientras la página pública sigue desplegada.
    document.body.classList.add('admin-returning');
    $('admin-panel').hidden = false;

    const panel = $('admin-panel');
    const margen = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--admin-panel-top-limit')
    ) || 50;
    const destino = panel.getBoundingClientRect().top + window.scrollY - margen;

    // Primero se baja hasta el panel; la web se oculta solamente al llegar.
    await desplazarSuavementeHasta(destino);

    document.body.classList.remove('admin-preview', 'admin-returning');
    $('volver-admin-flotante').hidden = true;

    // Al retirar el contenido público, ajustar la posición al panel ya recolocado.
    const posicionFinal = panel.getBoundingClientRect().top + window.scrollY - margen;
    window.scrollTo(0, Math.max(0, posicionFinal));

    cambioVistaEnCurso = false;
}

$('mostrar-vista-sitio').addEventListener('click', entrarVistaPrevia);
$('volver-admin-flotante').addEventListener('click', salirVistaPrevia);

// Ya no necesitamos bloquear el scroll: el contenido público se oculta en modo administrador.


async function abrirPanel() { document.body.classList.remove('admin-preview'); $('volver-admin-flotante').hidden = true; sesionAdmin = true; reiniciarTemporizadorInactividadAdmin(); $('admin-panel').hidden = false; document.body.classList.add('admin-mode'); $('login-dialog').close(); const margenSuperiorAdmin = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--admin-panel-top-limit')
    ) || 180;
    const posicionPanelAdmin = $('admin-panel').getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, posicionPanelAdmin - margenSuperiorAdmin), behavior: 'smooth' }); await Promise.all([cargarAdmin(), cargarContacto()]); }
$('abrir-admin').addEventListener('click', async () => { if (await verificarAdmin())
    return abrirPanel(); $('modo-demo').textContent = MODO_DEMO ? 'Modo demostración: puedes ver el catálogo, pero necesitas configurar Supabase para administrar y guardar datos reales.' : ''; $('login-dialog').showModal(); });
$('cerrar-login').addEventListener('click', () => $('login-dialog').close());
$('recuperar-password').addEventListener('click', async () => {
  const email = $('admin-email').value.trim();

  if (!email) {
    $('login-error').textContent = 'Primero escribe tu correo.';
    $('admin-email').focus();
    return;
  }

  if (MODO_DEMO) {
    $('login-error').textContent = 'Supabase no está configurado.';
    return;
  }

  const confirmar = window.confirm(
    `¿Deseas enviar un enlace para restablecer la contraseña a ${email}?`
  );

  if (!confirmar) return;

  const boton = $('recuperar-password');
  boton.disabled = true;
  $('login-error').textContent = 'Enviando solicitud…';

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    $('login-error').textContent = error
      ? 'Error al solicitar recuperación: ' + error.message
      : 'Si el correo está registrado, recibirás un enlace para cambiar la contraseña.';
  } catch (error) {
    $('login-error').textContent = 'No se pudo enviar la solicitud. Inténtalo nuevamente.';
    console.error('Error al solicitar recuperación de contraseña:', error);
  } finally {
    boton.disabled = false;
  }
});
$('cerrar-reset').addEventListener('click', () => $('reset-dialog').close());
$('reset-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('reset-password').value;
  const { error } = await supabaseClient.auth.updateUser({ password });
  $('reset-status').textContent = error ? 'No se pudo actualizar: ' + error.message :
    'Contraseña actualizada. Ya puedes iniciar sesión.';
  if (!error) {
    $('reset-password').value = '';
    setTimeout(() => $('reset-dialog').close(), 1800);
  }
});
if (!MODO_DEMO) {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      $('login-dialog').close();
      $('reset-status').textContent = '';
      $('reset-dialog').showModal();
    }
  });
}

$('login-form').addEventListener('submit', async (e) => { e.preventDefault(); $('login-error').textContent = ''; if (MODO_DEMO) {
    $('login-error').textContent = 'Configura primero el proyecto Supabase del vivero para habilitar el acceso.';
    return;
} const { error } = await supabaseClient.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value }); if (error) {
    $('login-error').textContent = 'Error de inicio de sesión: ' + error.message;
    return;
} if (!await verificarAdmin())
    return; await abrirPanel(); });
$('cerrar-sesion').addEventListener('click', () => cerrarSesionAdmin(false));
document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-panel]').forEach(x => x.classList.toggle('active', x === b));
    $('panel-productos').hidden = b.dataset.panel !== 'productos';
    $('panel-portada').hidden = b.dataset.panel !== 'portada';
    $('panel-nosotros').hidden = b.dataset.panel !== 'nosotros';
    $('panel-vivero').hidden = b.dataset.panel !== 'vivero';
    $('panel-contacto').hidden = b.dataset.panel !== 'contacto';
    if (b.dataset.panel === 'portada') cargarPortadaAdmin();
    if (b.dataset.panel === 'nosotros') cargarNosotrosAdmin();
    if (b.dataset.panel === 'vivero') cargarPresentacionViveroAdmin();
}));
async function cargarAdmin() { if (!sesionAdmin)
    return; $('estado-admin').textContent = 'Cargando…'; try {
    const { items, total } = await consultarPlantas({ pagina: paginaAdmin, tamano: ADMIN_SIZE, categoria: filtroAdmin, busqueda: busquedaAdmin });
    totalAdmin = total;
    $('tabla-plantas').innerHTML = items.map(p => {
        const fotoPrincipal = Array.isArray(p.fotos) ? p.fotos.find(Boolean) : '';
        const imagen = fotoPrincipal
            ? `<img class="admin-plant-thumb" src="${escapar(fotoPrincipal)}" alt="Imagen principal de ${escapar(p.nombre)}" loading="lazy">`
            : '<span class="admin-plant-placeholder">Sin foto</span>';
        return `<tr><td>${imagen}</td><td>${escapar(p.codigo)}</td><td>${escapar(p.nombre)}</td><td>${escapar(p.categoria)}</td><td>$${Number(p.precio).toFixed(2)}</td><td>${Number(p.stock)}</td><td>${Number(p.stock) > 0 ? 'Disponible' : 'Agotada'}</td><td><button data-editar="${p.id}">Editar</button><button data-borrar="${p.id}">Eliminar</button></td></tr>`;
    }).join('') || '<tr><td colspan="8">No hay resultados.</td></tr>';
    $('pagina-admin').textContent = `Página ${paginaAdmin + 1} de ${Math.max(1, Math.ceil(total / ADMIN_SIZE))}`;
    $('anterior-admin').disabled = paginaAdmin === 0;
    $('siguiente-admin').disabled = (paginaAdmin + 1) * ADMIN_SIZE >= total;
    $('estado-admin').textContent = `${total} planta(s) en el catálogo.`;
}
catch (e) {
    $('estado-admin').textContent = 'Error al consultar el inventario.';
    console.error(e);
} }
$('anterior-admin').addEventListener('click', () => { paginaAdmin = Math.max(0, paginaAdmin - 1); cargarAdmin(); });
$('siguiente-admin').addEventListener('click', () => { paginaAdmin++; cargarAdmin(); });
$('categoria-admin').addEventListener('change', e => { filtroAdmin = e.target.value; paginaAdmin = 0; cargarAdmin(); });
$('buscar-admin').addEventListener('input', e => { clearTimeout(debounce); debounce = setTimeout(() => { busquedaAdmin = e.target.value.trim(); paginaAdmin = 0; cargarAdmin(); }, 250); });
async function generarCodigoPlanta() {
    let codigos = [];
    if (MODO_DEMO) {
        codigos = (demo.plantas || []).map(p => p.codigo).filter(Boolean);
    } else {
        const { data, error } = await supabaseClient.from('plantas').select('codigo').limit(10000);
        if (error) throw error;
        codigos = (data || []).map(p => p.codigo).filter(Boolean);
    }
    const numeros = codigos.map(codigo => {
        const match = String(codigo).match(/^PL-(\d+)$/i);
        return match ? Number(match[1]) : 0;
    });
    const siguiente = Math.max(0, ...numeros) + 1;
    return `PL-${String(siguiente).padStart(3, '0')}`;
}
async function nuevaPlanta() {
    plantaEnEdicion = null;
    fotosQuitadas.clear();
    fotoPrincipalQuitada = false;
    $('planta-form').reset();
    $('planta-id').value = '';
    $('planta-codigo').value = '';
    $('planta-foto-principal').value = '';
    $('foto-principal-actual').innerHTML = '<p class="muted">Selecciona una fotografía principal para esta planta.</p>';
    $('fotos-actuales').innerHTML = '';
    $('estado-form').textContent = 'Generando código…';
    $('titulo-form').textContent = 'Agregar planta';
    $('planta-form').hidden = false;
    $('planta-form').scrollIntoView({ behavior: 'smooth' });
    try {
        $('planta-codigo').value = await generarCodigoPlanta();
        $('estado-form').textContent = '';
    } catch (error) {
        $('estado-form').textContent = 'No se pudo generar el código. Comprueba la conexión e inténtalo nuevamente.';
        console.error(error);
    }
}
$('nueva-planta').addEventListener('click', nuevaPlanta);
$('cancelar-edicion').addEventListener('click', () => { $('planta-form').hidden = true; plantaEnEdicion = null; fotosQuitadas.clear(); $('planta-form').reset(); $('fotos-actuales').innerHTML = ''; });
async function obtenerPlanta(id) { if (MODO_DEMO)
    return demo.plantas.find(p => String(p.id) === String(id)); const { data, error } = await supabaseClient.from('plantas').select('*').eq('id', id).single(); if (error)
    throw error; return data; }
let fotoPrincipalQuitada = false;
function renderFotoPrincipal() {
    const actual = plantaEnEdicion?.fotos?.[0] || '';
    const file = $('planta-foto-principal').files?.[0];
    if (file) {
        const preview = URL.createObjectURL(file);
        $('foto-principal-actual').innerHTML = `<div class="thumb-item"><img src="${preview}" alt="Nueva fotografía principal"><span>Lista para reemplazar</span></div>`;
    } else if (actual && !fotoPrincipalQuitada) {
        $('foto-principal-actual').innerHTML = `<div class="thumb-item"><img src="${escapar(actual)}" alt="Fotografía principal actual"><span>Fotografía principal actual</span><strong>No se puede quitar; puedes reemplazarla.</strong></div>`;
    } else {
        $('foto-principal-actual').innerHTML = '<p class="muted">Selecciona una fotografía principal para esta planta.</p>';
    }
}
function renderFotosActuales() {
    const fotos = (plantaEnEdicion?.fotos || []).slice(1).filter(url => !fotosQuitadas.has(url));
    $('fotos-actuales').innerHTML = fotos.map((url, i) => `<div class="thumb-item"><img src="${escapar(url)}" alt="Fotografía adicional ${i + 1}"><button type="button" data-quitar-foto="${i}">Quitar foto</button></div>`).join('');
}
$('planta-foto-principal').addEventListener('change', renderFotoPrincipal);
$('fotos-actuales').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-foto]');
    if (!b) return;
    const fotos = (plantaEnEdicion?.fotos || []).slice(1).filter(url => !fotosQuitadas.has(url));
    fotosQuitadas.add(fotos[Number(b.dataset.quitarFoto)]);
    renderFotosActuales();
});
$('tabla-plantas').addEventListener('click', async (e) => { const editar = e.target.closest('[data-editar]'), borrar = e.target.closest('[data-borrar]'); if (editar) {
    try {
        const p = await obtenerPlanta(editar.dataset.editar);
        plantaEnEdicion = p;
        fotosQuitadas.clear();
        fotoPrincipalQuitada = false;
        $('planta-form').reset();
        $('planta-foto-principal').value = '';
        renderFotoPrincipal();
        $('planta-id').value = p.id;
        for (const campo of ['codigo', 'nombre', 'categoria', 'precio', 'stock', 'descripcion'])
            $('planta-' + campo).value = p[campo] ?? '';
        $('titulo-form').textContent = 'Editar planta';
        $('estado-form').textContent = '';
        renderFotosActuales();
        $('planta-form').hidden = false;
        $('planta-form').scrollIntoView({ behavior: 'smooth' });
    }
    catch {
        alert('No se pudo cargar la planta.');
    }
} if (borrar) {
    if (!confirm('¿Eliminar esta planta del catálogo? Esta acción no se puede deshacer.'))
        return;
    try {
        if (MODO_DEMO) {
            demo.plantas = demo.plantas.filter(p => String(p.id) !== borrar.dataset.borrar);
            persistirDemo();
        }
        else {
            const { error } = await supabaseClient.from('plantas').delete().eq('id', borrar.dataset.borrar);
            if (error)
                throw error;
        }
        await cargarAdmin();
        await cargarPublico();
    }
    catch (e) {
        alert('No se pudo eliminar la planta.');
        console.error(e);
    }
} });
async function comprimirImagen(file, opciones = {}) {
    if (!file || !file.type.startsWith('image/')) throw Error('Selecciona un archivo de imagen válido.');
    if (file.size > 5 * 1024 * 1024) throw Error('Cada fotografía original debe pesar como máximo 5 MB.');
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.80 } = opciones;
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw Error('No se pudo leer la imagen. Prueba con JPG, PNG o WebP.'); }
    const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw Error('No se pudo comprimir la imagen.');
    return new File([blob], `${(file.name.replace(/\.[^.]+$/, '') || 'imagen')}.webp`, { type: 'image/webp', lastModified: Date.now() });
}
async function subirFoto(file, opciones = {}) {
    const optimizada = await comprimirImagen(file, opciones);
    const ruta = `${opciones.carpeta || 'plantas'}/${crypto.randomUUID()}.webp`;
    const { error } = await supabaseClient.storage.from('plantas').upload(ruta, optimizada, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    return supabaseClient.storage.from('plantas').getPublicUrl(ruta).data.publicUrl;
}
async function eliminarFotoStorage(url) {
    if (!url) return;
    const marker = '/storage/v1/object/public/plantas/';
    const index = url.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
    const { error } = await supabaseClient.storage.from('plantas').remove([path]);
    if (error) throw error;
}
$('planta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sesionAdmin) return;
    const boton = e.submitter;
    boton.disabled = true;
    $('estado-form').textContent = 'Optimizando y guardando fotografías…';
    const subidas = [];
    try {
        const archivosAdicionales = [...$('planta-fotos').files];
        const principalFile = $('planta-foto-principal').files?.[0] || null;
        const principalAnterior = plantaEnEdicion?.fotos?.[0] || '';
        if (!principalAnterior && !principalFile) throw Error('Cada planta debe tener una fotografía principal.');
        const adicionalesPrevias = (plantaEnEdicion?.fotos || []).slice(1).filter(u => !fotosQuitadas.has(u));
        if (adicionalesPrevias.length + archivosAdicionales.length > 3) throw Error('Máximo 3 fotografías adicionales por planta.');
        const codigo = $('planta-codigo').value.trim().toUpperCase();
        const nombre = $('planta-nombre').value.trim();
        const precio = Number($('planta-precio').value), stock = Number($('planta-stock').value);
        if (!codigo || !nombre || !Number.isFinite(precio) || precio < 0 || !Number.isInteger(stock) || stock < 0)
            throw Error('Revisa código, nombre, precio y stock.');
        if (MODO_DEMO) throw Error('Activa Supabase antes de guardar.');

        let principalNueva = principalAnterior;
        if (principalFile) {
            principalNueva = await subirFoto(principalFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.80 });
            subidas.push(principalNueva);
        }
        const nuevasAdicionales = [];
        for (const file of archivosAdicionales) {
            const url = await subirFoto(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.80 });
            nuevasAdicionales.push(url); subidas.push(url);
        }
        const fotosFinales = [principalNueva, ...adicionalesPrevias, ...nuevasAdicionales];
        const payload = { codigo, nombre, categoria: $('planta-categoria').value, precio, stock, descripcion: $('planta-descripcion').value.trim(), fotos: fotosFinales };
        const result = plantaEnEdicion
            ? await supabaseClient.from('plantas').update(payload).eq('id', plantaEnEdicion.id)
            : await supabaseClient.from('plantas').insert(payload);
        if (result.error) throw result.error;

        // Tras confirmar el cambio en la base, retirar las fotos antiguas que ya no se usan.
        const fotosAnteriores = plantaEnEdicion?.fotos || [];
        const fotosAEliminar = fotosAnteriores.filter(url => !fotosFinales.includes(url));
        for (const url of fotosAEliminar) {
            try { await eliminarFotoStorage(url); }
            catch (storageError) { console.warn('La planta se guardó, pero no se pudo borrar un archivo antiguo de Storage:', storageError); }
        }
        $('planta-form').hidden = true;
        plantaEnEdicion = null; fotosQuitadas.clear(); fotoPrincipalQuitada = false;
        paginaAdmin = 0;
        await Promise.all([cargarAdmin(), cargarPublico()]);
    } catch (err) {
        // Si falló la operación de base de datos, borrar los nuevos archivos subidos para no dejar huérfanos.
        for (const url of subidas) {
            try { await eliminarFotoStorage(url); } catch (cleanupError) { console.warn(cleanupError); }
        }
        $('estado-form').textContent = err.message || 'Error al guardar.';
        console.error(err);
    } finally { boton.disabled = false; }
});

// Portada pública y editor administrativo
let portadaActual = { titulo: '', subtitulo: '', imagen_url: '' };
let nuevaImagenPortada = null;

function aplicarPortada(portada) {
    if (!portada) return;
    portadaActual = {
        titulo: portada.titulo || '',
        subtitulo: portada.subtitulo || '',
        imagen_url: portada.imagen_url || ''
    };
    if (portadaActual.titulo) $('titulo-portada-publico').textContent = portadaActual.titulo;
    if (portadaActual.subtitulo) $('subtitulo-portada-publico').textContent = portadaActual.subtitulo;
    const img = $('imagen-portada-publica');
    if (portadaActual.imagen_url) {
        img.src = portadaActual.imagen_url;
        img.hidden = false;
        $('inicio').classList.add('has-cover-image');
    } else {
        img.removeAttribute('src');
        img.hidden = true;
        $('inicio').classList.remove('has-cover-image');
    }
}

async function cargarPortadaPublica() {
    if (MODO_DEMO) return;
    try {
        const { data, error } = await supabaseClient
            .from('configuracion_web')
            .select('titulo, subtitulo, imagen_url')
            .eq('id', 1)
            .maybeSingle();
        if (error) throw error;
        if (data) aplicarPortada(data);
    } catch (e) {
        console.error('No se pudo cargar la portada:', e);
    }
}

async function cargarPortadaAdmin() {
    if (!sesionAdmin) return;
    $('mensaje-portada').textContent = 'Cargando configuración…';
    nuevaImagenPortada = null;
    $('imagen-portada').value = '';
    try {
        if (MODO_DEMO) throw Error('Supabase no está configurado.');
        const { data, error } = await supabaseClient
            .from('configuracion_web')
            .select('titulo, subtitulo, imagen_url')
            .eq('id', 1)
            .single();
        if (error) throw error;
        portadaActual = data;
        $('titulo-portada').value = data.titulo || '';
        $('subtitulo-portada').value = data.subtitulo || '';
        if (data.imagen_url) {
            $('vista-imagen-portada').src = data.imagen_url;
            $('vista-imagen-portada').hidden = false;
        } else {
            $('vista-imagen-portada').removeAttribute('src');
            $('vista-imagen-portada').hidden = true;
        }
        $('mensaje-portada').textContent = '';
    } catch (e) {
        $('mensaje-portada').textContent = 'No se pudo cargar la portada. Comprueba que ejecutaste la migración SQL de portada.';
        console.error(e);
    }
}

function cancelarEdicionPortada() {
    nuevaImagenPortada = null;
    $('imagen-portada').value = '';
    $('titulo-portada').value = portadaActual.titulo || '';
    $('subtitulo-portada').value = portadaActual.subtitulo || '';

    const imagen = $('vista-imagen-portada');
    if (portadaActual.imagen_url) {
        imagen.src = portadaActual.imagen_url;
        imagen.hidden = false;
    } else {
        imagen.removeAttribute('src');
        imagen.hidden = true;
    }
    $('mensaje-portada').textContent = 'Cambios descartados.';
}
$('cancelar-portada').addEventListener('click', cancelarEdicionPortada);

$('imagen-portada').addEventListener('change', () => {
    const file = $('imagen-portada').files?.[0];
    nuevaImagenPortada = file || null;
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        $('mensaje-portada').textContent = 'Selecciona una imagen válida de máximo 5 MB.';
        $('imagen-portada').value = '';
        nuevaImagenPortada = null;
        return;
    }
    const previewUrl = URL.createObjectURL(file);
    $('vista-imagen-portada').src = previewUrl;
    $('vista-imagen-portada').hidden = false;
    $('mensaje-portada').textContent = 'Vista previa lista. Recuerda guardar los cambios.';
});

async function subirImagenPortada(file) {
    return subirFoto(file, { carpeta: 'portada', maxWidth: 1920, maxHeight: 1080, quality: 0.85 });
}

$('portada-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sesionAdmin) return;
    const boton = $('guardar-portada');
    boton.disabled = true;
    $('mensaje-portada').textContent = 'Guardando cambios…';
    try {
        if (MODO_DEMO) throw Error('Supabase no está configurado.');
        const titulo = $('titulo-portada').value.trim();
        const subtitulo = $('subtitulo-portada').value.trim();
        if (!titulo || !subtitulo) throw Error('Completa el título y el subtítulo.');
        let imagen_url = portadaActual.imagen_url || '';
        if (nuevaImagenPortada) imagen_url = await subirImagenPortada(nuevaImagenPortada);
        const imagenAnterior = portadaActual.imagen_url || '';
        const { error } = await supabaseClient
            .from('configuracion_web')
            .update({ titulo, subtitulo, imagen_url })
            .eq('id', 1);
        if (error) throw error;
        if (nuevaImagenPortada && imagenAnterior && imagenAnterior !== imagen_url) {
            try { await eliminarFotoStorage(imagenAnterior); }
            catch (storageError) { console.warn('Portada guardada; no se pudo borrar la imagen anterior:', storageError); }
        }
        portadaActual = { titulo, subtitulo, imagen_url };
        aplicarPortada(portadaActual);
        nuevaImagenPortada = null;
        $('imagen-portada').value = '';
        $('mensaje-portada').textContent = 'Portada actualizada correctamente.';
    } catch (err) {
        $('mensaje-portada').textContent = err.message || 'No se pudo guardar la portada.';
        console.error(err);
    } finally {
        boton.disabled = false;
    }
});


// Sección pública y editor administrativo "Sobre nosotros"
let nosotrosActual = { titulo: '', contenido: '', imagen_url: '' };
let nuevaImagenNosotros = null;

function aplicarNosotros(datos) {
    if (!datos) return;
    nosotrosActual = {
        titulo: datos.titulo || '',
        contenido: datos.contenido || '',
        imagen_url: datos.imagen_url || ''
    };
    $('titulo-nosotros-publico').textContent = nosotrosActual.titulo;
    $('contenido-nosotros-publico').textContent = nosotrosActual.contenido;
    const img = $('imagen-nosotros-publica');
    const placeholder = $('imagen-nosotros-vacia');
    if (nosotrosActual.imagen_url) {
        img.src = nosotrosActual.imagen_url;
        img.hidden = false;
        placeholder.hidden = true;
    } else {
        img.removeAttribute('src');
        img.hidden = true;
        placeholder.hidden = false;
    }
}

async function cargarNosotrosPublico() {
    if (MODO_DEMO) return;
    try {
        const { data, error } = await supabaseClient
            .from('sobre_nosotros')
            .select('titulo, contenido, imagen_url')
            .eq('id', 1)
            .maybeSingle();
        if (error) throw error;
        if (data) aplicarNosotros(data);
    } catch (e) {
        console.error('No se pudo cargar Sobre nosotros:', e);
    }
}

async function cargarNosotrosAdmin() {
    if (!sesionAdmin) return;
    $('mensaje-nosotros').textContent = 'Cargando configuración…';
    nuevaImagenNosotros = null;
    $('imagen-nosotros').value = '';
    try {
        if (MODO_DEMO) throw Error('Supabase no está configurado.');
        const { data, error } = await supabaseClient
            .from('sobre_nosotros')
            .select('titulo, contenido, imagen_url')
            .eq('id', 1)
            .single();
        if (error) throw error;
        nosotrosActual = data;
        $('titulo-nosotros').value = data.titulo || '';
        $('contenido-nosotros').value = data.contenido || '';
        if (data.imagen_url) {
            $('vista-imagen-nosotros').src = data.imagen_url;
            $('vista-imagen-nosotros').hidden = false;
        } else {
            $('vista-imagen-nosotros').removeAttribute('src');
            $('vista-imagen-nosotros').hidden = true;
        }
        $('mensaje-nosotros').textContent = '';
    } catch (e) {
        $('mensaje-nosotros').textContent = 'No se pudo cargar esta sección. Comprueba que ejecutaste migracion_sobre_nosotros.sql.';
        console.error(e);
    }
}

function cancelarEdicionNosotros() {
    nuevaImagenNosotros = null;
    $('imagen-nosotros').value = '';
    $('titulo-nosotros').value = nosotrosActual.titulo || '';
    $('contenido-nosotros').value = nosotrosActual.contenido || '';

    const imagen = $('vista-imagen-nosotros');
    if (nosotrosActual.imagen_url) {
        imagen.src = nosotrosActual.imagen_url;
        imagen.hidden = false;
    } else {
        imagen.removeAttribute('src');
        imagen.hidden = true;
    }
    $('mensaje-nosotros').textContent = 'Cambios descartados.';
}
$('cancelar-nosotros').addEventListener('click', cancelarEdicionNosotros);

$('imagen-nosotros').addEventListener('change', () => {
    const file = $('imagen-nosotros').files?.[0];
    nuevaImagenNosotros = file || null;
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
        $('mensaje-nosotros').textContent = 'Selecciona una imagen válida de máximo 5 MB.';
        $('imagen-nosotros').value = '';
        nuevaImagenNosotros = null;
        return;
    }
    $('vista-imagen-nosotros').src = URL.createObjectURL(file);
    $('vista-imagen-nosotros').hidden = false;
    $('mensaje-nosotros').textContent = 'Vista previa lista. Recuerda guardar los cambios.';
});

$('nosotros-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sesionAdmin) return;
    const boton = $('guardar-nosotros');
    boton.disabled = true;
    $('mensaje-nosotros').textContent = 'Guardando cambios…';
    try {
        if (MODO_DEMO) throw Error('Supabase no está configurado.');
        const titulo = $('titulo-nosotros').value.trim();
        const contenido = $('contenido-nosotros').value.trim();
        if (!titulo || !contenido) throw Error('Completa el título y el contenido.');
        let imagen_url = nosotrosActual.imagen_url || '';
        if (nuevaImagenNosotros) imagen_url = await subirFoto(nuevaImagenNosotros, { carpeta: 'sobre-nosotros', maxWidth: 1600, maxHeight: 1600, quality: 0.82 });
        const imagenAnterior = nosotrosActual.imagen_url || '';
        const { error } = await supabaseClient
            .from('sobre_nosotros')
            .update({ titulo, contenido, imagen_url, actualizado_en: new Date().toISOString() })
            .eq('id', 1);
        if (error) throw error;
        if (nuevaImagenNosotros && imagenAnterior && imagenAnterior !== imagen_url) {
            try { await eliminarFotoStorage(imagenAnterior); }
            catch (storageError) { console.warn('Sección guardada; no se pudo borrar la imagen anterior:', storageError); }
        }
        nosotrosActual = { titulo, contenido, imagen_url };
        aplicarNosotros(nosotrosActual);
        nuevaImagenNosotros = null;
        $('imagen-nosotros').value = '';
        $('mensaje-nosotros').textContent = 'Sección Sobre nosotros actualizada correctamente.';
    } catch (err) {
        $('mensaje-nosotros').textContent = err.message || 'No se pudo guardar la sección.';
        console.error(err);
    } finally {
        boton.disabled = false;
    }
});


// Nueva sección independiente: "Conoce nuestro vivero"
const VIVERO_BUCKET = 'vivero-presentacion';
const VIVERO_MAX_FOTOS = 5;
let presentacionVivero = { titulo: 'Conoce nuestro vivero', descripcion: 'Un espacio lleno de vida, naturaleza y plantas para cada rincón.', fotos: [] };
let borradorFotosVivero = [];

function renderCarruselVivero() {
    const fotos = presentacionVivero.fotos;
    const total = fotos.length;
    const centro = total ? viveroIndiceFoto : -1;
    const izquierda = total >= 3 ? (centro - 1 + total) % total : -1;
    const derecha = total >= 2 ? (centro + 1) % total : -1;

    const tarjetaIzquierda = $('vivero-foto-izquierda');
    const tarjetaCentro = $('vivero-foto-centro');
    const tarjetaDerecha = $('vivero-foto-derecha');

    tarjetaIzquierda.hidden = izquierda < 0;
    tarjetaCentro.hidden = centro < 0;
    tarjetaDerecha.hidden = derecha < 0;
    $('vivero-foto-vacia').hidden = total > 0;

    if (izquierda >= 0) {
        tarjetaIzquierda.querySelector('img').src = fotos[izquierda];
        tarjetaIzquierda.querySelector('img').alt = `Fotografía ${izquierda + 1} de nuestro vivero`;
        tarjetaIzquierda.dataset.viveroIr = izquierda;
    } else {
        tarjetaIzquierda.querySelector('img').removeAttribute('src');
        delete tarjetaIzquierda.dataset.viveroIr;
    }

    if (centro >= 0) {
        const imagenCentral = tarjetaCentro.querySelector('img');
        imagenCentral.src = fotos[centro];
        imagenCentral.alt = `Fotografía ${centro + 1} de ${total} de nuestro vivero`;
        tarjetaCentro.dataset.viveroIr = centro;
    } else {
        tarjetaCentro.querySelector('img').removeAttribute('src');
        delete tarjetaCentro.dataset.viveroIr;
    }

    if (derecha >= 0) {
        tarjetaDerecha.querySelector('img').src = fotos[derecha];
        tarjetaDerecha.querySelector('img').alt = `Fotografía ${derecha + 1} de nuestro vivero`;
        tarjetaDerecha.dataset.viveroIr = derecha;
    } else {
        tarjetaDerecha.querySelector('img').removeAttribute('src');
        delete tarjetaDerecha.dataset.viveroIr;
    }

    $('vivero-foto-contador').textContent = total ? `${centro + 1} / ${total}` : '';
    const varias = total > 1;
    $('vivero-foto-anterior').hidden = !varias;
    $('vivero-foto-siguiente').hidden = !varias;
    $('vivero-puntos').innerHTML = fotos.map((_, i) =>
        `<button type="button" data-vivero-ir="${i}" aria-label="Ver fotografía ${i + 1}" aria-current="${i === viveroIndiceFoto}"></button>`
    ).join('');
}
let viveroIndiceFoto = 0;

function aplicarPresentacionVivero(datos) {
    if (!datos) return;
    presentacionVivero = {
        titulo: datos.titulo || 'Conoce nuestro vivero',
        descripcion: datos.descripcion || '',
        fotos: Array.isArray(datos.fotos) ? datos.fotos.filter(Boolean) : []
    };
    viveroIndiceFoto = Math.min(viveroIndiceFoto, Math.max(0, presentacionVivero.fotos.length - 1));
    $('titulo-vivero-publico').textContent = presentacionVivero.titulo;
    $('descripcion-vivero-publica').textContent = presentacionVivero.descripcion;
    renderCarruselVivero();
}

async function cargarPresentacionViveroPublica() {
    if (MODO_DEMO) return;
    try {
        const { data, error } = await supabaseClient.from('presentacion_vivero')
            .select('titulo, descripcion, fotos').eq('id', 1).maybeSingle();
        if (error) throw error;
        if (data) aplicarPresentacionVivero(data);
    } catch (error) {
        console.error('No se pudo cargar Conoce nuestro vivero:', error);
    }
}

$('vivero-foto-anterior').addEventListener('click', () => {
    if (presentacionVivero.fotos.length < 2) return;
    viveroIndiceFoto = (viveroIndiceFoto - 1 + presentacionVivero.fotos.length) % presentacionVivero.fotos.length;
    renderCarruselVivero();
});
$('vivero-foto-siguiente').addEventListener('click', () => {
    if (presentacionVivero.fotos.length < 2) return;
    viveroIndiceFoto = (viveroIndiceFoto + 1) % presentacionVivero.fotos.length;
    renderCarruselVivero();
});
$('vivero-carousel-stage').addEventListener('click', e => {
    const tarjeta = e.target.closest('[data-vivero-ir]');
    if (!tarjeta) return;
    viveroIndiceFoto = Number(tarjeta.dataset.viveroIr);
    renderCarruselVivero();
});
$('vivero-puntos').addEventListener('click', e => {
    const boton = e.target.closest('[data-vivero-ir]');
    if (!boton) return;
    viveroIndiceFoto = Number(boton.dataset.viveroIr);
    renderCarruselVivero();
});

function renderEditorFotosVivero() {
    $('vivero-fotos-editor').innerHTML = borradorFotosVivero.map((foto, i) => `
      <article class="vivero-admin-photo">
        <img src="${escapar(foto.preview || foto.url)}" alt="Fotografía ${i + 1} del vivero">
        <p>Fotografía ${i + 1}${foto.file ? ' · Nueva' : ''}</p>
        <div class="vivero-admin-photo-actions">
          <button type="button" data-vivero-subir="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Mover fotografía a la izquierda">←</button>
          <button type="button" data-vivero-bajar="${i}" ${i === borradorFotosVivero.length - 1 ? 'disabled' : ''} aria-label="Mover fotografía a la derecha">→</button>
          <button type="button" data-vivero-abrir-reemplazo="${i}">Reemplazar</button>
          <input type="file" accept="image/jpeg,image/png,image/webp" data-vivero-reemplazar="${i}" hidden>
          <button type="button" class="btn-danger" data-vivero-quitar="${i}">Eliminar</button>
        </div>
      </article>`).join('') || '<p class="muted">Todavía no has agregado fotografías.</p>';
}

async function cargarPresentacionViveroAdmin() {
    if (!sesionAdmin) return;
    $('mensaje-vivero').textContent = 'Cargando configuración…';
    try {
        if (MODO_DEMO) throw Error('Supabase no está configurado. La sección se puede revisar en la vista pública, pero para guardar cambios debes conectar Supabase.');
        const { data, error } = await supabaseClient.from('presentacion_vivero')
            .select('titulo, descripcion, fotos').eq('id', 1).single();
        if (error) throw error;
        aplicarPresentacionVivero(data);
        $('titulo-vivero').value = presentacionVivero.titulo;
        $('descripcion-vivero').value = presentacionVivero.descripcion;
        borradorFotosVivero = presentacionVivero.fotos.map(url => ({ url }));
        renderEditorFotosVivero();
        $('mensaje-vivero').textContent = '';
    } catch (error) {
        $('mensaje-vivero').textContent = error.message || 'No se pudo cargar la sección. Ejecuta la migración SQL de esta nueva sección.';
        console.error(error);
    }
}

$('fotos-vivero').addEventListener('change', () => {
    const archivos = [...($('fotos-vivero').files || [])];
    const disponibles = VIVERO_MAX_FOTOS - borradorFotosVivero.length;
    if (archivos.length > disponibles) {
        $('mensaje-vivero').textContent = `Puedes tener como máximo ${VIVERO_MAX_FOTOS} fotografías. Espacios disponibles: ${disponibles}.`;
    }
    archivos.slice(0, Math.max(0, disponibles)).forEach(file => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            $('mensaje-vivero').textContent = `La fotografía "${file.name}" no es válida o supera 5 MB.`;
            return;
        }
        borradorFotosVivero.push({ file, preview: URL.createObjectURL(file), name: file.name });
    });
    $('fotos-vivero').value = '';
    renderEditorFotosVivero();
});

$('vivero-fotos-editor').addEventListener('click', e => {
    const abrirReemplazo = e.target.closest('[data-vivero-abrir-reemplazo]');
    if (abrirReemplazo) {
        abrirReemplazo.parentElement.querySelector('[data-vivero-reemplazar]')?.click();
        return;
    }

    const subir = e.target.closest('[data-vivero-subir]');
    const bajar = e.target.closest('[data-vivero-bajar]');
    const quitar = e.target.closest('[data-vivero-quitar]');
    const i = Number((subir || bajar || quitar)?.dataset.viveroSubir ??
        (subir || bajar || quitar)?.dataset.viveroBajar ??
        (subir || bajar || quitar)?.dataset.viveroQuitar);
    if (!Number.isInteger(i)) return;

    if (quitar) {
        const foto = borradorFotosVivero.splice(i, 1)[0];
        if (foto?.preview) URL.revokeObjectURL(foto.preview);
    } else {
        const destino = subir ? i - 1 : i + 1;
        if (destino < 0 || destino >= borradorFotosVivero.length) return;
        [borradorFotosVivero[i], borradorFotosVivero[destino]] = [borradorFotosVivero[destino], borradorFotosVivero[i]];
    }
    renderEditorFotosVivero();
});

$('vivero-fotos-editor').addEventListener('change', e => {
    const campo = e.target.closest('[data-vivero-reemplazar]');
    if (!campo) return;

    const i = Number(campo.dataset.viveroReemplazar);
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!Number.isInteger(i) || !archivo) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 5 * 1024 * 1024) {
        $('mensaje-vivero').textContent = `La fotografía "${archivo.name}" no es válida o supera 5 MB.`;
        return;
    }

    const fotoAnterior = borradorFotosVivero[i];
    if (!fotoAnterior) return;
    if (fotoAnterior.preview) URL.revokeObjectURL(fotoAnterior.preview);

    borradorFotosVivero[i] = {
        file: archivo,
        preview: URL.createObjectURL(archivo),
        name: archivo.name
    };
    $('mensaje-vivero').textContent = `Fotografía ${i + 1} reemplazada en el borrador. Guarda la sección para aplicar el cambio.`;
    renderEditorFotosVivero();
});

$('cancelar-vivero').addEventListener('click', () => {
    borradorFotosVivero.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    $('titulo-vivero').value = presentacionVivero.titulo;
    $('descripcion-vivero').value = presentacionVivero.descripcion;
    borradorFotosVivero = presentacionVivero.fotos.map(url => ({ url }));
    $('fotos-vivero').value = '';
    renderEditorFotosVivero();
    $('mensaje-vivero').textContent = 'Cambios descartados.';
});

async function subirFotoPresentacionVivero(file) {
    const optimizada = await comprimirImagen(file, { maxWidth: 1800, maxHeight: 1400, quality: 0.84 });
    const ruta = `galeria/${crypto.randomUUID()}.webp`;
    const { error } = await supabaseClient.storage.from(VIVERO_BUCKET)
        .upload(ruta, optimizada, { contentType: 'image/webp', upsert: false });
    if (error) throw error;
    return supabaseClient.storage.from(VIVERO_BUCKET).getPublicUrl(ruta).data.publicUrl;
}

async function eliminarFotoPresentacionVivero(url) {
    const marker = `/storage/v1/object/public/${VIVERO_BUCKET}/`;
    const index = String(url || '').indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
    const { error } = await supabaseClient.storage.from(VIVERO_BUCKET).remove([path]);
    if (error) throw error;
}

$('vivero-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!sesionAdmin) return;
    const boton = $('guardar-vivero');
    boton.disabled = true;
    $('mensaje-vivero').textContent = 'Guardando texto y fotografías…';
    const subidas = [];
    try {
        if (MODO_DEMO) throw Error('Conecta Supabase y ejecuta la migración SQL antes de guardar esta sección.');
        const titulo = $('titulo-vivero').value.trim();
        const descripcion = $('descripcion-vivero').value.trim();
        if (!titulo || !descripcion) throw Error('Completa el título y la descripción.');
        if (borradorFotosVivero.length > VIVERO_MAX_FOTOS) throw Error('El máximo es de cinco fotografías.');
        const fotos = [];
        for (const foto of borradorFotosVivero) {
            if (foto.file) {
                const url = await subirFotoPresentacionVivero(foto.file);
                subidas.push(url);
                fotos.push(url);
            } else if (foto.url) fotos.push(foto.url);
        }
        const { error } = await supabaseClient.from('presentacion_vivero')
            .upsert({ id: 1, titulo, descripcion, fotos, actualizado_en: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        const fotosAnteriores = presentacionVivero.fotos || [];
        presentacionVivero = { titulo, descripcion, fotos };
        aplicarPresentacionVivero(presentacionVivero);
        for (const url of fotosAnteriores.filter(url => !fotos.includes(url))) {
            try { await eliminarFotoPresentacionVivero(url); }
            catch (storageError) { console.warn('La sección se guardó, pero no se pudo borrar una fotografía antigua:', storageError); }
        }
        borradorFotosVivero.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
        borradorFotosVivero = fotos.map(url => ({ url }));
        renderEditorFotosVivero();
        $('mensaje-vivero').textContent = 'Sección «Conoce nuestro vivero» actualizada correctamente.';
    } catch (error) {
        for (const url of subidas) {
            try { await eliminarFotoPresentacionVivero(url); } catch (cleanupError) { console.warn(cleanupError); }
        }
        $('mensaje-vivero').textContent = error.message || 'No se pudo guardar la sección.';
        console.error(error);
    } finally {
        boton.disabled = false;
    }
});


$('numero-whatsapp').addEventListener('input', () => {
    const campo = $('numero-whatsapp');
    let digitos = campo.value.replace(/\D/g, '');
    if (digitos.startsWith('593') && digitos.length >= 12) digitos = '0' + digitos.slice(3);
    else if (digitos.startsWith('9') && digitos.length === 9) digitos = '0' + digitos;
    campo.value = digitos.slice(0, 10);
});

function cancelarEdicionContacto() {
    $('numero-whatsapp').value = numeroLocalEcuador(contactoActual.whatsapp);
    $('url-facebook').value = contactoActual.facebook || '';
    $('url-instagram').value = contactoActual.instagram || '';
    $('url-tiktok').value = contactoActual.tiktok || '';
    $('estado-contacto').textContent = 'Cambios descartados.';
}
$('cancelar-contacto').addEventListener('click', cancelarEdicionContacto);

$('contacto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter || $('contacto-form').querySelector('button[type="submit"]');
    boton.disabled = true;
    $('estado-contacto').textContent = 'Guardando cambios…';
    try {
        if (MODO_DEMO) throw Error('Configura Supabase primero.');
        const datosAnteriores = await obtenerContacto();
        const numeroIngresado = $('numero-whatsapp').value.trim();
        // WhatsApp es obligatorio: si se deja vacío, conserva el número previamente guardado.
        const whatsapp = numeroIngresado
            ? normalizarNumeroEcuador(numeroIngresado)
            : (datosAnteriores.whatsapp || '');
        if (!whatsapp) throw Error('El número de WhatsApp es obligatorio. Ingresa un número que comience por 09.');
        const facebook = validarUrlRed($('url-facebook').value, 'facebook') || null;
        const instagram = validarUrlRed($('url-instagram').value, 'instagram') || null;
        const tiktok = validarUrlRed($('url-tiktok').value, 'tiktok') || null;
        const { error } = await supabaseClient
            .from('configuracion')
            .update({ whatsapp, facebook, instagram, tiktok })
            .eq('id', 1);
        if (error) throw error;
        $('estado-contacto').textContent = 'Contacto actualizado correctamente.';
        await cargarContacto();
    } catch (e) {
        $('estado-contacto').textContent = e.message || 'No se pudo guardar el contacto.';
        console.error(e);
    } finally {
        boton.disabled = false;
    }
});
llenarCategorias();
cargarPublico();
cargarContacto();
cargarPortadaPublica();
cargarNosotrosPublico();
cargarPresentacionViveroPublica();
