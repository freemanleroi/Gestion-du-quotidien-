/* Écrans et enregistrement. Toute la logique de calcul est dans logic.js */
(function () {
  'use strict';
  var L = window.Logic;
  var CLE = 'suivi-commercial-v1';
  var PRENOM = 'Fouad';

  var etat = charger();
  var onglet = 'aujourdhui';
  var semaine = null;
  var toastTimer = null;

  /* ---------- utilitaires ---------- */
  function today() { return window.__AUJOURDHUI || L.iso(new Date()); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(s) { return s ? s.split('-').reverse().join('/') : ''; }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function $(sel, racine) { return (racine || document).querySelector(sel); }
  function val(sel) { var e = $(sel); return e ? e.value.trim() : ''; }
  function personne(id) { return etat.interlocuteurs.find(function (p) { return p.id === id; }); }
  function nomPersonne(id) { var p = personne(id); return p ? p.nom : '(personne supprimée)'; }
  function objectif(id) { return etat.objectifs.find(function (o) { return o.id === id; }); }
  function echange(id) { return etat.echanges.find(function (e) { return e.id === id; }); }

  function charger() {
    try {
      var brut = localStorage.getItem(CLE);
      if (!brut) return L.nouvelEtat();
      return L.importerEtat(brut);
    } catch (e) {
      try { localStorage.setItem(CLE + '-corrompu', localStorage.getItem(CLE) || ''); } catch (x) {}
      return L.nouvelEtat();
    }
  }
  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); }
    catch (e) { toast('⚠️ Impossible d\'enregistrer sur cet appareil. Faites une sauvegarde (Réglages).'); }
  }
  function modifier(fn) { fn(); sauver(); rendre(); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function appliquerTheme() {
    var t = etat.reglages.theme;
    if (t === 'clair') document.documentElement.setAttribute('data-theme', 'light');
    else if (t === 'sombre') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  function telecharger(nom, type, contenu) {
    var blob = new Blob([contenu], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function copier(texte) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texte).then(function () { toast('Texte copié'); }, repli);
    }
    repli();
    function repli() {
      var ta = document.createElement('textarea'); ta.value = texte; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); toast('Texte copié'); } catch (e) { toast('Copie impossible : sélectionnez le texte à la main'); }
      ta.remove();
    }
  }

  /* ---------- fenêtre modale ---------- */
  function ouvrir(html) { var m = $('#modal'); m.innerHTML = '<div class="feuille">' + html + '</div>'; m.hidden = false; }
  function fermer() { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

  /* ---------- composants ---------- */
  function puceUrgence(niveau, jours) {
    var txt = niveau === 'retard' ? 'En retard de ' + pluriel(-jours, 'jour', 'jours')
      : niveau === 'aujourdhui' ? 'Aujourd\'hui'
      : 'Dans ' + pluriel(jours, 'jour', 'jours');
    return '<span class="puce ' + niveau + '">' + txt + '</span>';
  }
  function optionsBoite(sel) {
    return '<option value="">— Choisir —</option>' + L.BOITES.map(function (b) {
      return '<option' + (b === sel ? ' selected' : '') + '>' + esc(b) + '</option>';
    }).join('');
  }
  function casesPersonnes(selection, prefixe) {
    var liste = etat.interlocuteurs.filter(function (p) { return !p.archive; });
    var cases = liste.length ? liste.map(function (p) {
      return '<label><input type="checkbox" name="' + prefixe + '" value="' + p.id + '"' + (selection.indexOf(p.id) >= 0 ? ' checked' : '') + '>' + esc(p.nom) + (p.organisation ? ' <span class="doux">· ' + esc(p.organisation) + '</span>' : '') + '</label>';
    }).join('') : '<p class="sous">Aucun interlocuteur pour l\'instant : ajoutez-en ci-dessous.</p>';
    return '<div class="cases">' + cases + '</div>' +
      '<label for="f-nouvelles">Ajouter de nouvelles personnes (séparées par une virgule)</label><input id="f-nouvelles" placeholder="Ex : Alice Martin, Bruno Leroy">';
  }
  function cochees(prefixe) {
    return Array.prototype.map.call(document.querySelectorAll('#modal input[name="' + prefixe + '"]:checked'), function (c) { return c.value; });
  }
  // Crée les nouvelles personnes saisies à la main et renvoie leurs identifiants.
  function creerNouvelles(texte) {
    var ids = [];
    texte.split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (nom) {
      var p = { id: L.uid(), nom: nom, organisation: '', email: '' };
      etat.interlocuteurs.push(p); ids.push(p.id);
    });
    return ids;
  }

  /* ---------- AUJOURD'HUI ---------- */
  function vueAujourdhui() {
    var t = today();
    var h = '<div class="entete"><div><h1>Bonjour ' + PRENOM + '</h1><p class="sous">' + esc(L.formatDateLongue(t)) + '</p></div>' +
      '<button class="rond" data-a="reglages" aria-label="Réglages">⚙︎</button></div>';

    if (L.sauvegardeDue(etat, t)) {
      h += '<div class="bandeau"><b>Pensez à sauvegarder vos données.</b><br><span class="doux">' +
        (etat.reglages.dernierExport ? 'Dernière sauvegarde : ' + fmt(etat.reglages.dernierExport) + '.' : 'Aucune sauvegarde faite pour l\'instant.') +
        '</span><div class="actions"><button class="principal petit" data-a="exporter">Sauvegarder maintenant</button></div></div>';
    }

    var prio = etat.priorite.date === t && etat.priorite.texte;
    h += '<div class="carte priorite cliquable" data-a="edit-priorite"><div class="meta">Ma priorité du jour</div>' +
      (prio ? '<div class="texte">' + esc(etat.priorite.texte) + '</div>' : '<div class="doux">Touchez pour définir la priorité du jour</div>') + '</div>';

    var enCours = L.actifs(etat).filter(function (o) { return o.statut !== 'termine'; }).length;
    var attentes = L.relancesEnAttente(etat, t);
    h += '<div class="resume"><div class="carte"><div class="nombre">' + enCours + '</div><div class="meta">objectif' + (enCours > 1 ? 's' : '') + ' en cours</div></div>' +
      '<div class="carte"><div class="nombre">' + attentes.length + '</div><div class="meta">réponse' + (attentes.length > 1 ? 's' : '') + ' en attente</div></div></div>';

    h += '<h2>Deadlines du jour et à venir</h2>';
    var urg = L.urgences(etat, t);
    h += urg.length ? urg.map(function (u) {
      var o = u.objectif;
      return '<div class="carte cliquable" data-a="ouvrir-objectif" data-id="' + o.id + '"><div class="ligne"><span class="titre">' + esc(o.titre) + '</span>' + puceUrgence(u.niveau, u.jours) + '</div>' +
        '<div class="meta">Échéance le ' + fmt(o.echeance) + (o.boite ? ' · ' + esc(o.boite) : '') + '</div></div>';
    }).join('') : '<div class="vide">Aucune deadline dans les 7 prochains jours.</div>';

    h += '<h2>Relances en attente</h2>';
    h += attentes.length ? attentes.map(function (r) {
      return '<div class="carte"><div class="ligne"><span class="titre"><span class="pastille ' + (r.due ? 'relance' : 'pas_repondu') + '"></span>' + esc(nomPersonne(r.dest.personneId)) + '</span>' +
        (r.due ? '<span class="puce relance">Relance à faire</span>' : '<span class="puce">En attente</span>') + '</div>' +
        '<div class="meta">' + esc(r.echange.titre) + ' · sans réponse depuis ' + pluriel(r.jours, 'jour', 'jours') + '</div>' +
        '<div class="actions"><button class="petit' + (r.due ? ' principal' : '') + '" data-a="relancer" data-e="' + r.echange.id + '" data-p="' + r.dest.personneId + '">Préparer la relance</button>' +
        '<button class="petit" data-a="repondu" data-e="' + r.echange.id + '" data-p="' + r.dest.personneId + '">Il/elle a répondu</button></div></div>';
    }).join('') : '<div class="vide">Aucune réponse en attente.</div>';
    return h;
  }

  /* ---------- OBJECTIFS ---------- */
  function vueObjectifs() {
    var t = today();
    var liste = L.actifs(etat);
    var enCours = liste.filter(function (o) { return o.statut !== 'termine'; })
      .sort(function (a, b) { return (a.echeance || '9999') < (b.echeance || '9999') ? -1 : 1; });
    var finis = liste.filter(function (o) { return o.statut === 'termine'; });
    var h = '<div class="entete"><div><h1>Objectifs</h1><p class="sous">' + pluriel(enCours.length, 'objectif en cours', 'objectifs en cours') + '</p></div>' +
      '<button class="principal rond" data-a="nouvel-objectif" aria-label="Nouvel objectif">+</button></div>';
    function carte(o) {
      var u = o.echeance && o.statut !== 'termine' ? L.niveauUrgence(L.diffDays(t, o.echeance)) : null;
      return '<div class="carte cliquable" data-a="ouvrir-objectif" data-id="' + o.id + '"><div class="ligne"><span class="titre">' + esc(o.titre) + '</span>' +
        '<span class="puce ' + (o.statut === 'termine' ? 'termine' : '') + '">' + L.STATUT_LABEL[o.statut] + '</span></div>' +
        '<div class="meta">' + (o.echeance ? 'Échéance le ' + fmt(o.echeance) : 'Sans échéance') +
        (u && u !== 'plus_tard' ? ' · ' + puceUrgence(u, L.diffDays(t, o.echeance)) : '') + '</div>' +
        (o.boite ? '<div class="meta">' + esc(o.boite) + '</div>' : '') +
        (o.personnes.length ? '<div class="meta">' + o.personnes.map(nomPersonne).map(esc).join(', ') + '</div>' : '') + '</div>';
    }
    h += enCours.length ? enCours.map(carte).join('') : '<div class="vide">Aucun objectif en cours. Touchez + pour en créer un.</div>';
    if (finis.length) h += '<h2>Terminés</h2>' + finis.map(carte).join('');
    return h;
  }

  function formObjectif(o) {
    o = o || { titre: '', echeance: '', boite: '', statut: 'pas_commence', personnes: [] };
    var h = '<h1>' + (o.id ? 'Objectif' : 'Nouvel objectif') + '</h1>' +
      '<label for="f-titre">Intitulé</label><input id="f-titre" value="' + esc(o.titre) + '" placeholder="Ex : Obtenir la validation du partenaire">' +
      '<label for="f-echeance">Échéance</label><input id="f-echeance" type="date" value="' + esc(o.echeance || '') + '">' +
      '<label for="f-boite">Boîte mail du suivi</label><select id="f-boite">' + optionsBoite(o.boite) + '</select>' +
      '<label for="f-statut">Statut</label><select id="f-statut">' + L.STATUTS.map(function (s) {
        return '<option value="' + s + '"' + (s === o.statut ? ' selected' : '') + '>' + L.STATUT_LABEL[s] + '</option>';
      }).join('') + '</select>' +
      '<label>Personnes concernées</label>' + casesPersonnes(o.personnes, 'pers') +
      '<div class="actions"><button class="principal" data-a="save-objectif" data-id="' + (o.id || '') + '">Enregistrer</button>' +
      '<button data-a="fermer">Annuler</button>';
    if (o.id) {
      if (o.echeance) h += '<button data-a="agenda" data-date="' + o.echeance + '" data-titre="' + esc('Échéance : ' + o.titre) + '">📅 Ajouter l\'échéance à mon agenda</button>';
      h += '<button class="danger" data-a="suppr-objectif" data-id="' + o.id + '">Supprimer</button>';
    }
    h += '</div>';
    if (o.id && o.historique.length) {
      h += '<h2>Historique des modifications</h2>' + o.historique.slice().reverse().map(function (x) {
        var noms = { titre: 'Intitulé', echeance: 'Échéance', boite: 'Boîte', statut: 'Statut', personnes: 'Personnes' };
        function v(c, val) { return c === 'statut' ? L.STATUT_LABEL[val] : c === 'echeance' ? fmt(val) : c === 'personnes' ? val.map(nomPersonne).join(', ') || '—' : val || '—'; }
        return '<div class="stat"><span class="doux">' + fmt(x.date) + ' · ' + noms[x.champ] + '</span><span>' + esc(v(x.champ, x.ancien)) + ' → ' + esc(v(x.champ, x.nouveau)) + '</span></div>';
      }).join('');
    }
    return h;
  }

  /* ---------- INTERLOCUTEURS ---------- */
  var LIBELLE_IND = { repondu: 'A répondu', pas_repondu: 'N\'a pas répondu', relance: 'Relance à prévoir', aucun: 'Aucun échange' };
  function vuePersonnes() {
    var t = today();
    var liste = etat.interlocuteurs.filter(function (p) { return !p.archive; })
      .sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var h = '<div class="entete"><div><h1>Interlocuteurs</h1><p class="sous">' + pluriel(liste.length, 'personne suivie', 'personnes suivies') + '</p></div>' +
      '<button class="principal rond" data-a="nouvelle-personne" aria-label="Nouvelle personne">+</button></div>';
    h += liste.length ? liste.map(function (p) {
      var ind = L.indicateurPersonne(etat, p.id, t);
      var dc = L.dernierContactPersonne(etat, p.id);
      return '<div class="carte cliquable" data-a="ouvrir-personne" data-id="' + p.id + '"><div class="ligne"><span class="titre"><span class="pastille ' + ind + '"></span>' + esc(p.nom) + '</span>' +
        '<span class="puce ' + (ind === 'repondu' ? 'repondu' : ind === 'relance' ? 'relance' : '') + '">' + LIBELLE_IND[ind] + '</span></div>' +
        '<div class="meta">' + (p.organisation ? esc(p.organisation) + ' · ' : '') + (dc ? 'Dernier contact : ' + fmt(dc) : 'Pas encore de contact') + '</div></div>';
    }).join('') : '<div class="vide">Aucun interlocuteur. Touchez + pour en ajouter.</div>';
    return h;
  }

  function fichePersonne(p) {
    p = p || { nom: '', organisation: '', email: '' };
    var t = today();
    var h = '<h1>' + (p.id ? esc(p.nom) : 'Nouvelle personne') + '</h1>' +
      '<label for="f-nom">Nom</label><input id="f-nom" value="' + esc(p.nom) + '">' +
      '<label for="f-org">Organisation (facultatif)</label><input id="f-org" value="' + esc(p.organisation || '') + '">' +
      '<label for="f-email">Adresse mail (facultatif, sert à préparer une relance)</label><input id="f-email" type="email" value="' + esc(p.email || '') + '">' +
      '<div class="actions"><button class="principal" data-a="save-personne" data-id="' + (p.id || '') + '">Enregistrer</button><button data-a="fermer">Fermer</button>' +
      (p.id ? '<button class="danger" data-a="suppr-personne" data-id="' + p.id + '">Supprimer</button>' : '') + '</div>';
    if (p.id) {
      var ind = L.indicateurPersonne(etat, p.id, t);
      h += '<h2>Situation</h2><div class="carte"><span class="pastille ' + ind + '"></span>' + LIBELLE_IND[ind] + '</div>';
      var objs = L.actifs(etat).filter(function (o) { return o.personnes.indexOf(p.id) >= 0; });
      h += '<h2>Objectifs concernés</h2>' + (objs.length ? objs.map(function (o) {
        return '<div class="carte cliquable" data-a="ouvrir-objectif" data-id="' + o.id + '"><div class="ligne"><span class="titre">' + esc(o.titre) + '</span><span class="puce">' + L.STATUT_LABEL[o.statut] + '</span></div></div>';
      }).join('') : '<div class="vide">Aucun objectif.</div>');
      var ech = etat.echanges.filter(function (e) { return e.destinataires.some(function (d) { return d.personneId === p.id; }); })
        .sort(function (a, b) { return a.envoyeLe < b.envoyeLe ? 1 : -1; });
      h += '<h2>Historique des échanges</h2>' + (ech.length ? ech.map(function (e) {
        var d = e.destinataires.find(function (x) { return x.personneId === p.id; });
        return '<div class="carte"><div class="titre">' + esc(e.titre) + '</div><div class="meta">Mail envoyé le ' + fmt(e.envoyeLe) + '</div>' +
          (d.relances.length ? '<div class="meta">Relancé le ' + d.relances.map(fmt).join(', ') + '</div>' : '') +
          '<div class="meta">' + (d.reponduLe ? '✅ Réponse reçue le ' + fmt(d.reponduLe) : 'Pas de réponse (' + pluriel(L.joursDepuisEnvoi(e, t), 'jour', 'jours') + ')') + '</div></div>';
      }).join('') : '<div class="vide">Aucun échange.</div>');
    }
    return h;
  }

  /* ---------- SUIVI DES ÉCHANGES ---------- */
  function vueEchanges() {
    var t = today();
    var ouverts = etat.echanges.filter(function (e) { return !e.modifsEnvoyeesLe; }).sort(function (a, b) { return a.envoyeLe < b.envoyeLe ? 1 : -1; });
    var clos = etat.echanges.filter(function (e) { return e.modifsEnvoyeesLe; }).sort(function (a, b) { return a.envoyeLe < b.envoyeLe ? 1 : -1; });
    var h = '<div class="entete"><div><h1>Suivi des échanges</h1><p class="sous">' + pluriel(ouverts.length, 'échange ouvert', 'échanges ouverts') + '</p></div>' +
      '<button class="principal rond" data-a="nouvel-echange" aria-label="Nouvel échange">+</button></div>';
    h += ouverts.length ? ouverts.map(function (e) { return carteEchange(e, t); }).join('') : '<div class="vide">Aucun échange en cours. Touchez + après avoir envoyé un mail à plusieurs personnes.</div>';
    if (clos.length) h += '<h2>Terminés</h2>' + clos.map(function (e) { return carteEchange(e, t); }).join('');
    return h;
  }

  function carteEchange(e, t) {
    var st = L.statutEchange(e);
    var o = e.objectifId ? objectif(e.objectifId) : null;
    var pct = st.total ? Math.round(100 * st.repondus.length / st.total) : 0;
    var h = '<div class="carte" data-echange="' + e.id + '"><div class="ligne"><span class="titre">' + esc(e.titre) + '</span>' +
      (e.modifsEnvoyeesLe ? '<span class="puce termine">Terminé</span>' : st.complet ? '<span class="puce ok">Complet</span>' : '<span class="puce">' + st.repondus.length + '/' + st.total + ' réponses</span>') + '</div>' +
      '<div class="meta">Envoyé le ' + fmt(e.envoyeLe) + (e.boite ? ' · ' + esc(e.boite) : '') + (o ? ' · Objectif : ' + esc(o.titre) : '') + '</div>' +
      (e.mailRef ? '<div class="meta">Mail : ' + esc(e.mailRef) + '</div>' : '') +
      '<div class="barre"><i style="width:' + pct + '%"></i></div><div style="margin-top:8px">';
    h += e.destinataires.map(function (d) {
      var due = L.relanceDue(e, d, t);
      var ind = d.reponduLe ? 'repondu' : due ? 'relance' : 'pas_repondu';
      var etatTxt = d.reponduLe ? 'Répondu le ' + fmt(d.reponduLe) : (due ? 'Relance à faire · ' : 'En attente · ') + pluriel(L.joursDepuisEnvoi(e, t), 'jour', 'jours') + (d.relances.length ? ' · relancé ' + pluriel(d.relances.length, 'fois', 'fois') : '');
      var btns = e.modifsEnvoyeesLe ? '' : d.reponduLe
        ? '<button class="petit" data-a="annuler-reponse" data-e="' + e.id + '" data-p="' + d.personneId + '">Annuler</button>'
        : '<button class="petit' + (due ? ' principal' : '') + '" data-a="relancer" data-e="' + e.id + '" data-p="' + d.personneId + '">Relancer</button>' +
          '<button class="petit" data-a="repondu" data-e="' + e.id + '" data-p="' + d.personneId + '">A répondu</button>';
      return '<div class="destinataire"><div><span class="pastille ' + ind + '"></span><b>' + esc(nomPersonne(d.personneId)) + '</b><div class="meta" style="margin-left:19px">' + etatTxt + '</div></div><div class="actions" style="margin:0">' + btns + '</div></div>';
    }).join('');
    h += '</div>';
    var dates = (e.datesProposees || []).filter(Boolean);
    if (dates.length && !e.dateRetenue) {
      h += '<div class="meta" style="margin-top:8px">Dates proposées : ' + dates.map(function (d) {
        return '<button class="petit" data-a="agenda" data-date="' + d + '" data-titre="' + esc('Date proposée : ' + e.titre) + '">📅 ' + esc(L.formatDateLongue(d)) + '</button>';
      }).join(' ') + '</div>';
    }
    if (e.dateRetenue) h += '<div class="meta" style="margin-top:8px">Date retenue : <b>' + esc(L.formatDateLongue(e.dateRetenue)) + '</b> <button class="petit" data-a="agenda" data-date="' + e.dateRetenue + '" data-titre="' + esc('Date retenue : ' + e.titre) + '">📅 Agenda</button></div>';
    if (st.complet && !e.modifsEnvoyeesLe) {
      h += '<div class="bandeau ok" style="margin-top:10px"><b>✅ Toutes les réponses sont reçues.</b><br><span class="doux">Vous pouvez envoyer les modifications.</span>' +
        '<div class="actions"><button class="principal" data-a="modifs" data-e="' + e.id + '">J\'ai envoyé les modifications</button></div></div>';
    }
    if (e.modifsEnvoyeesLe) h += '<div class="meta" style="margin-top:8px">Modifications envoyées le ' + fmt(e.modifsEnvoyeesLe) + '</div>';
    h += '<div class="actions">';
    if (!st.complet) h += '<button class="petit" data-a="toutes-reponses" data-e="' + e.id + '">Toutes les réponses sont reçues</button>';
    h += '<button class="petit danger" data-a="suppr-echange" data-e="' + e.id + '">Supprimer</button></div></div>';
    return h;
  }

  function formEchange() {
    var t = today();
    var objs = L.actifs(etat).filter(function (o) { return o.statut !== 'termine'; });
    return '<h1>Nouvel échange groupé</h1>' +
      '<label for="f-titre">Sujet du mail</label><input id="f-titre" placeholder="Ex : Choix de la date de la réunion de lancement">' +
      '<label for="f-obj">Objectif concerné (facultatif)</label><select id="f-obj"><option value="">— Aucun —</option>' + objs.map(function (o) { return '<option value="' + o.id + '">' + esc(o.titre) + '</option>'; }).join('') + '</select>' +
      '<label for="f-boite">Boîte mail utilisée</label><select id="f-boite">' + optionsBoite('') + '</select>' +
      '<label for="f-mail">Mail rattaché : objet ou lien (facultatif, à copier-coller)</label><input id="f-mail" placeholder="Objet du mail ou lien">' +
      '<label for="f-envoi">Envoyé le</label><input id="f-envoi" type="date" value="' + t + '">' +
      '<label for="f-delai">Relancer après combien de jours sans réponse ?</label><input id="f-delai" type="number" min="1" max="60" value="' + etat.reglages.delaiRelance + '">' +
      '<label>Dates proposées (facultatif)</label><input id="f-d1" type="date"><div style="height:6px"></div><input id="f-d2" type="date"><div style="height:6px"></div><input id="f-d3" type="date">' +
      '<label>Personnes sollicitées</label>' + casesPersonnes([], 'dest') +
      '<div class="actions"><button class="principal" data-a="save-echange">Créer l\'échange</button><button data-a="fermer">Annuler</button></div>';
  }

  function modalRelance(eid, pid) {
    var e = echange(eid), p = personne(pid);
    if (!e) return;
    var texte = L.relanceTexte(e, p, e.objectifId ? objectif(e.objectifId) : null);
    ouvrir('<h1>Relance à ' + esc(nomPersonne(pid)) + '</h1>' +
      '<p class="sous">Texte à copier ou adapter. L\'application n\'envoie rien : c\'est vous qui envoyez.</p>' +
      '<textarea id="f-texte">' + esc(texte) + '</textarea>' +
      '<div class="actions"><button class="principal" data-a="copier">Copier le texte</button>' +
      (p && p.email ? '<button data-a="mailto" data-p="' + p.id + '" data-e="' + e.id + '">Ouvrir dans Mail</button>' : '') +
      '<button data-a="relance-faite" data-e="' + eid + '" data-p="' + pid + '">J\'ai relancé : l\'enregistrer</button>' +
      '<button data-a="fermer">Fermer</button></div>');
  }

  /* ---------- BILANS ---------- */
  function pct(x) { return x === null ? 'Pas assez de données' : Math.round(x * 100) + ' %'; }
  function jours(x) { return x === null ? 'Pas assez de données' : (Math.round(x * 10) / 10).toString().replace('.', ',') + ' jour' + (x >= 2 ? 's' : ''); }
  function tend(actuel, precedent, unite) {
    var d = L.tendance(actuel, precedent);
    if (d === null) return '';
    var r = Math.round(d * 10) / 10;
    var s = r === 0 ? '= identique à la semaine précédente' : (r > 0 ? '↑ +' : '↓ ') + (unite === '%' ? Math.round(d * 100) + ' pts' : String(r).replace('.', ',')) + ' vs semaine précédente';
    return ' <span class="doux" style="font-size:13px">(' + s + ')</span>';
  }
  function lignesJour(b) {
    function l(a, v) { return '<div class="stat"><span>' + a + '</span><b>' + v + '</b></div>'; }
    return l('Deadlines tenues', b.tenues) + l('Deadlines non tenues', b.nonTenues) +
      (b.aVenir ? l('Deadlines du jour (en cours)', b.aVenir) : '') +
      l('Relances effectuées', b.relances) + l('Réponses reçues', b.reponses) + l('Échanges débloqués (complets)', b.debloques);
  }
  function vueBilans() {
    var t = today();
    if (!semaine) semaine = L.debutSemaine(t);
    var bj = L.bilanJour(etat, t, t);
    var h = '<h1>Bilans</h1><p class="sous">Calculés automatiquement, rien à remplir.</p>';
    h += '<h2>Aujourd\'hui</h2><div class="carte">' + (bj.saisie ? lignesJour(bj) : '<span class="doux">Pas assez de données : rien de saisi ni de prévu aujourd\'hui.</span>') + '</div>';

    var bs = L.bilanSemaine(etat, semaine, t);
    var bp = L.bilanSemaine(etat, L.addDays(semaine, -7), t);
    var estCourante = semaine === L.debutSemaine(t);
    h += '<h2>Semaine du ' + fmt(semaine) + ' au ' + fmt(bs.fin) + '</h2>' +
      '<div class="actions" style="margin:0 0 8px"><button class="petit" data-a="sem-prec">← Précédente</button>' + (estCourante ? '' : '<button class="petit" data-a="sem-suiv">Suivante →</button><button class="petit" data-a="sem-auj">Cette semaine</button>') + '</div>';
    if (!bs.joursSaisis) {
      h += '<div class="carte"><span class="doux">Pas assez de données : aucun jour renseigné cette semaine-là.</span></div>';
    } else {
      var pBp = bp.joursSaisis ? bp : null;
      h += '<div class="carte">' +
        '<div class="stat"><span>Jours avec activité</span><b>' + bs.joursSaisis + '</b></div>' +
        '<div class="stat"><span>Objectifs avancés</span><b>' + bs.avances + '</b></div>' +
        '<div class="stat"><span>Objectifs atteints</span><b>' + bs.atteints + '</b></div>' +
        '<div class="stat"><span>Deadlines tenues</span><b>' + pct(bs.taux) + tend(bs.taux, pBp && pBp.taux, '%') + '</b></div>' +
        '<div class="stat"><span>Relances effectuées</span><b>' + bs.relances + tend(bs.relances, pBp && pBp.relances) + '</b></div>' +
        '<div class="stat"><span>Délai moyen de réponse</span><b>' + jours(bs.delaiMoyen) + tend(bs.delaiMoyen, pBp && pBp.delaiMoyen) + '</b></div>' +
        '<div class="stat"><span>Échanges encore en attente</span><b>' + bs.enAttente + '</b></div></div>' +
        '<p class="sous">Les jours sans activité ni deadline prévue sont exclus. Les tendances comparent deux chiffres, sans en déduire de cause.</p>';
    }

    h += '<h2>Historique des jours</h2>';
    var lignes = [];
    for (var i = 0; i < 60; i++) {
      var d = L.addDays(t, -i);
      var b = L.bilanJour(etat, d, t);
      if (b.saisie) lignes.push('<div class="carte cliquable" data-a="detail-jour" data-date="' + d + '"><div class="ligne"><span class="titre">' + esc(L.formatDateLongue(d)) + ' ' + fmt(d).slice(0, 5) + '</span>' +
        '<span class="meta">' + b.tenues + ' tenue' + (b.tenues > 1 ? 's' : '') + ' · ' + b.nonTenues + ' non tenue' + (b.nonTenues > 1 ? 's' : '') + ' · ' + b.relances + ' relance' + (b.relances > 1 ? 's' : '') + '</span></div></div>');
    }
    h += lignes.length ? lignes.join('') : '<div class="vide">Pas encore d\'historique.</div>';
    return h;
  }

  /* ---------- RÉGLAGES ---------- */
  function modalReglages() {
    var r = etat.reglages;
    ouvrir('<h1>Réglages</h1>' +
      '<label for="f-theme">Apparence</label><select id="f-theme">' + [['auto', 'Automatique (suit l\'iPad)'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(function (x) { return '<option value="' + x[0] + '"' + (r.theme === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<label for="f-delai">Délai de relance par défaut (jours)</label><input id="f-delai" type="number" min="1" max="60" value="' + r.delaiRelance + '">' +
      '<div class="actions"><button class="principal" data-a="save-reglages">Enregistrer</button></div>' +
      '<h2>Sauvegarde</h2><p class="sous">' + (r.dernierExport ? 'Dernière sauvegarde : ' + fmt(r.dernierExport) : 'Aucune sauvegarde faite.') + '</p>' +
      '<div class="actions"><button data-a="exporter">Sauvegarder (fichier)</button><label class="btn" style="margin:0;display:inline-flex;align-items:center;color:var(--texte)">Restaurer un fichier<input id="f-import" type="file" accept=".json,application/json" style="display:none"></label></div>' +
      '<p class="sous" style="margin-top:12px">Vos données sont <b>uniquement sur cet iPad</b>, dans cette application. Il n\'y a pas de synchronisation entre appareils. Elles sont perdues si vous effacez les données de Safari, supprimez l\'icône, changez d\'appareil ou si l\'adresse du site change. Le fichier de sauvegarde permet de tout retrouver.</p>' +
      '<h2>Agenda</h2><div class="actions"><button data-a="agenda-tout">📅 Ajouter toutes mes dates à l\'agenda</button></div>' +
      '<p class="sous" style="margin-top:8px">Ouvre un fichier que l\'iPad propose d\'ajouter au Calendrier. Une connexion permanente automatique n\'est pas possible depuis ce type d\'application.</p>' +
      '<h2>Boîtes mail</h2><p class="sous">Dans cette version, les mails sont rattachés à la main (objet ou lien) et c\'est vous qui indiquez qui a répondu. La connexion automatique en lecture seule viendra dans une étape suivante.</p>' +
      '<div class="actions"><button data-a="fermer">Fermer</button></div>');
  }

  /* ---------- rendu général ---------- */
  function rendre() {
    appliquerTheme();
    var vues = { aujourdhui: vueAujourdhui, objectifs: vueObjectifs, personnes: vuePersonnes, echanges: vueEchanges, bilans: vueBilans };
    $('#vue').innerHTML = vues[onglet]();
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
      b.classList.toggle('actif', b.getAttribute('data-tab') === onglet);
      if (b.getAttribute('data-tab') === onglet) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  /* ---------- actions ---------- */
  var ACTIONS = {
    fermer: fermer,
    reglages: modalReglages,
    'edit-priorite': function () {
      var t = today();
      ouvrir('<h1>Ma priorité du jour</h1><label for="f-prio">Quelle est ma priorité aujourd\'hui ?</label><input id="f-prio" value="' + esc(etat.priorite.date === t ? etat.priorite.texte : '') + '">' +
        '<div class="actions"><button class="principal" data-a="save-priorite">Enregistrer</button><button data-a="fermer">Annuler</button></div>');
    },
    'save-priorite': function () { modifier(function () { etat.priorite = { date: today(), texte: val('#f-prio') }; }); fermer(); },
    'nouvel-objectif': function () { ouvrir(formObjectif()); },
    'ouvrir-objectif': function (el) { var o = objectif(el.dataset.id); if (o) ouvrir(formObjectif(o)); },
    'save-objectif': function (el) {
      var titre = val('#f-titre');
      if (!titre) { toast('Donnez un intitulé à l\'objectif'); return; }
      var id = el.dataset.id;
      modifier(function () {
        var pers = cochees('pers').concat(creerNouvelles(val('#f-nouvelles')));
        var data = { titre: titre, echeance: val('#f-echeance') || null, boite: val('#f-boite'), statut: val('#f-statut'), personnes: pers };
        if (id) L.modifierObjectif(etat, id, data, today()); else L.creerObjectif(etat, data, today());
      });
      fermer();
    },
    'suppr-objectif': function (el) {
      if (!confirm('Supprimer cet objectif ? Les bilans passés le conserveront.')) return;
      modifier(function () { L.supprimerObjectif(etat, el.dataset.id, today()); }); fermer();
    },
    'nouvelle-personne': function () { ouvrir(fichePersonne()); },
    'ouvrir-personne': function (el) { var p = personne(el.dataset.id); if (p) ouvrir(fichePersonne(p)); },
    'save-personne': function (el) {
      var nom = val('#f-nom');
      if (!nom) { toast('Indiquez un nom'); return; }
      modifier(function () {
        var p = el.dataset.id ? personne(el.dataset.id) : null;
        if (!p) { p = { id: L.uid() }; etat.interlocuteurs.push(p); }
        p.nom = nom; p.organisation = val('#f-org'); p.email = val('#f-email');
      });
      fermer();
    },
    'suppr-personne': function (el) {
      if (!confirm('Supprimer cette personne ?')) return;
      modifier(function () {
        var id = el.dataset.id;
        var utilisee = etat.echanges.some(function (e) { return e.destinataires.some(function (d) { return d.personneId === id; }); });
        if (utilisee) { personne(id).archive = true; } // on garde son nom dans l'historique des échanges
        else etat.interlocuteurs = etat.interlocuteurs.filter(function (p) { return p.id !== id; });
        etat.objectifs.forEach(function (o) { o.personnes = o.personnes.filter(function (x) { return x !== id; }); });
      });
      fermer();
    },
    'nouvel-echange': function () { ouvrir(formEchange()); },
    'save-echange': function () {
      var titre = val('#f-titre');
      if (!titre) { toast('Indiquez le sujet du mail'); return; }
      var nouvelles = val('#f-nouvelles');
      var coches = cochees('dest');
      if (!coches.length && !nouvelles) { toast('Choisissez au moins une personne'); return; }
      modifier(function () {
        var pers = coches.concat(creerNouvelles(nouvelles));
        L.creerEchange(etat, {
          titre: titre, objectifId: val('#f-obj') || null, boite: val('#f-boite'), mailRef: val('#f-mail'),
          envoyeLe: val('#f-envoi') || today(), delaiRelance: parseInt(val('#f-delai'), 10) || etat.reglages.delaiRelance,
          datesProposees: [val('#f-d1'), val('#f-d2'), val('#f-d3')].filter(Boolean), personnes: pers
        }, today());
        var o = null;
        var oid = val('#f-obj');
        if (oid && (o = objectif(oid)) && o.statut !== 'en_attente' && o.statut !== 'termine') L.modifierObjectif(etat, oid, { statut: 'en_attente' }, today());
      });
      fermer();
    },
    repondu: function (el) {
      ouvrir('<h1>Réponse de ' + esc(nomPersonne(el.dataset.p)) + '</h1><label for="f-date">Date de la réponse</label><input id="f-date" type="date" value="' + today() + '">' +
        '<div class="actions"><button class="principal" data-a="save-reponse" data-e="' + el.dataset.e + '" data-p="' + el.dataset.p + '">Enregistrer</button><button data-a="fermer">Annuler</button></div>');
    },
    'save-reponse': function (el) {
      var date = val('#f-date') || today();
      var e = echange(el.dataset.e);
      if (e && date < e.envoyeLe) { toast('La réponse ne peut pas précéder l\'envoi du mail (' + fmt(e.envoyeLe) + ')'); return; }
      modifier(function () { L.marquerReponse(etat, el.dataset.e, el.dataset.p, date); });
      fermer();
      if (e && L.statutEchange(e).complet) toast('✅ Échange complet : vous pouvez envoyer les modifications');
    },
    'annuler-reponse': function (el) { modifier(function () { L.annulerReponse(etat, el.dataset.e, el.dataset.p); }); },
    relancer: function (el) { modalRelance(el.dataset.e, el.dataset.p); },
    copier: function () { copier(val('#f-texte')); },
    mailto: function (el) {
      var p = personne(el.dataset.p), e = echange(el.dataset.e);
      location.href = 'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent('Relance : ' + e.titre) + '&body=' + encodeURIComponent(val('#f-texte'));
    },
    'relance-faite': function (el) { modifier(function () { L.enregistrerRelance(etat, el.dataset.e, el.dataset.p, today()); }); fermer(); toast('Relance enregistrée'); },
    'toutes-reponses': function (el) {
      if (!confirm('Marquer toutes les personnes restantes comme ayant répondu ?')) return;
      modifier(function () { L.toutesReponsesRecues(etat, el.dataset.e, today()); });
    },
    modifs: function (el) {
      var e = echange(el.dataset.e);
      ouvrir('<h1>Modifications envoyées</h1><label for="f-retenue">Date retenue (facultatif)</label><input id="f-retenue" type="date" value="' + esc(e.dateRetenue || '') + '">' +
        '<div class="actions"><button class="principal" data-a="save-modifs" data-e="' + e.id + '">Terminer l\'échange</button><button data-a="fermer">Annuler</button></div>');
    },
    'save-modifs': function (el) {
      modifier(function () {
        L.modificationsEnvoyees(etat, el.dataset.e, today(), val('#f-retenue') || null);
        var e = echange(el.dataset.e);
        if (e && e.objectifId) { var o = objectif(e.objectifId); if (o && o.statut === 'en_attente') L.modifierObjectif(etat, o.id, { statut: 'en_cours' }, today()); }
      });
      fermer();
    },
    'suppr-echange': function (el) {
      if (!confirm('Supprimer cet échange ? Les bilans déjà enregistrés sont conservés.')) return;
      modifier(function () { etat.echanges = etat.echanges.filter(function (e) { return e.id !== el.dataset.e; }); });
    },
    agenda: function (el) {
      telecharger('rendez-vous.ics', 'text/calendar', L.genererICS([{ date: el.dataset.date, titre: el.dataset.titre }]));
      toast('Ouvrez le fichier pour l\'ajouter au Calendrier');
    },
    'agenda-tout': function () {
      var items = L.datesAgenda(etat);
      if (!items.length) { toast('Aucune date à ajouter pour l\'instant'); return; }
      telecharger('mes-dates.ics', 'text/calendar', L.genererICS(items));
      toast(pluriel(items.length, 'date', 'dates') + ' dans le fichier');
    },
    exporter: function () {
      modifier(function () { etat.reglages.dernierExport = today(); });
      telecharger('sauvegarde-suivi-' + today() + '.json', 'application/json', JSON.stringify(etat, null, 2));
      toast('Sauvegarde créée : gardez ce fichier dans un endroit sûr');
    },
    'save-reglages': function () {
      modifier(function () { etat.reglages.theme = val('#f-theme'); etat.reglages.delaiRelance = parseInt(val('#f-delai'), 10) || 3; });
      fermer();
    },
    'sem-prec': function () { semaine = L.addDays(semaine, -7); rendre(); },
    'sem-suiv': function () { semaine = L.addDays(semaine, 7); rendre(); },
    'sem-auj': function () { semaine = L.debutSemaine(today()); rendre(); },
    'detail-jour': function (el) {
      var b = L.bilanJour(etat, el.dataset.date, today());
      ouvrir('<h1>' + esc(L.formatDateLongue(el.dataset.date)) + ' ' + fmt(el.dataset.date) + '</h1><div class="carte">' + lignesJour(b) + '</div><div class="actions"><button data-a="fermer">Fermer</button></div>');
    }
  };

  document.addEventListener('click', function (ev) {
    var tab = ev.target.closest('[data-tab]');
    if (tab) { onglet = tab.getAttribute('data-tab'); fermer(); rendre(); window.scrollTo(0, 0); return; }
    var el = ev.target.closest('[data-a]');
    if (el) {
      if (ev.target.closest('button') && el.classList.contains('carte')) { /* un bouton dans une carte cliquable */ }
      var inner = ev.target.closest('button[data-a]');
      if (inner) el = inner;
      var f = ACTIONS[el.dataset.a]; if (f) f(el);
      return;
    }
    if (ev.target.id === 'modal') fermer();
  });
  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'f-import') return;
    var fichier = ev.target.files[0]; if (!fichier) return;
    var lecteur = new FileReader();
    lecteur.onload = function () {
      try {
        var nouveau = L.importerEtat(String(lecteur.result));
        if (!confirm('Remplacer toutes les données actuelles par celles de ce fichier ?')) return;
        etat = nouveau; sauver(); fermer(); rendre(); toast('Sauvegarde restaurée');
      } catch (e) { toast(e.message); }
    };
    lecteur.readAsText(fichier);
  });

  window.__suivi = { etat: function () { return etat; } }; // pour les tests uniquement
  rendre();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
