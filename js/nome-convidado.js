/*
 * Nome mostrado ao convidado (envelope, topo do site, RSVP e mensagem do WhatsApp).
 * Usado por index.html, rsvp.html e admin.html.
 *
 *   1. displayName, se preenchido no admin ("Nome que o convidado vê")
 *   2. senão, o que vem depois do hífen: "Família Noivo - Tio Tony" → "Tio Tony"
 *      (o começo é organização interna de vocês); sem hífen, o 1º integrante
 *   3. com mais de uma pessoa, acrescenta "e família" ("Tio Tony e família"),
 *      a não ser que o nome já cite duas pessoas ("Natália e João")
 */
function friendlyName(family) {
  if (family.displayName) return family.displayName;

  const members = family.members || [];
  const parts = family.familyName.split(' - ');
  let base = parts.length > 1 ? parts[parts.length - 1].trim() : (members[0] && members[0].name);
  if (!base) return family.familyName;

  if (members.length > 1 && !/ e /i.test(base)) base += ' e família';
  return base;
}
