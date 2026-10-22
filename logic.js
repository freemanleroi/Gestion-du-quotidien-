/* Logique de suivi : aucune dépendance à l'écran. Testée par test.js */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUTS = ['pas_commence', 'en_cours', 'en_attente', 'termine'];
  var STATUT_LABEL = {
    pas_commence: 'Pas commencé',
    en_cours: 'En cours',
    en_attente: 'En attente de réponses',
    termine: 'Terminé'
  };
  var BOITES = [
    'f.bellakhdar@apajh.asso.fr',
    'fb.scibhl@gmail.com',
    'commercial@valreo.fr'
  ];

  /* ---------- dates (format AAAA-MM-JJ) ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) {
    var x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function utc(s) { var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function diffDays(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function addDays(s, n) {
    var d = new Date(utc(s) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function debutSemaine(s) { // lundi
    var dow = new Date(utc(s)).getUTCDay(); // 0 = dimanche
    return addDays(s, -((dow + 6) % 7));
  }
  function uid() { return 'i' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function ratio(a, b) { return b === 0 ? null : a / b; }

  /* ---------- état ---------- */
  function nouvelEtat() {
    return {
      version: 1,
      objectifs: [],
      interlocuteurs: [],
      echanges: [],
      journal: [],
      priorite: { date: null, texte: '' },
      reglages: { delaiRelance: 3, theme: 'auto', dernierExport: null }
    };
  }

  function log(etat, date, type, extra) {
    var e = { date: date, type: type };
    for (var k in extra) e[k] = extra[k];
    etat.journal.push(e);
  }

  /* ---------- objectifs ---------- */
  function creerObjectif(etat, data, today) {
    var o = {
      id: uid(),
      titre: data.titre,
      echeance: data.echeance || null,
      boite: data.boite || '',
      personnes: data.personnes || [],
      statut: data.statut || 'pas_commence',
      creeLe: today,
      termineLe: null,
      supprimeLe: null,
      historique: []
    };
    if (o.statut === 'termine') o.termineLe = today;
    etat.objectifs.push(o);
    log(etat, today, 'objectif_cree', { objectifId: o.id, titre: o.titre });
    return o;
  }

  // La modification s'applique à partir d'aujourd'hui ; l'ancien état est gardé dans l'historique.
  function modifierObjectif(etat, id, changes, today) {
    var o = etat.objectifs.find(function (x) { return x.id === id; });
    if (!o) return null;
    ['titre', 'echeance', 'boite', 'statut', 'personnes'].forEach(function (champ) {
      if (!(champ in changes)) return;
      var ancien = o[champ], nouveau = changes[champ];
      if (JSON.stringify(ancien) === JSON.stringify(nouveau)) return;
      o.historique.push({ date: today, champ: champ, ancien: ancien, nouveau: nouveau });
      o[champ] = nouveau;
      if (champ === 'statut') {
        if (nouveau === 'termine') {
          o.termineLe = today;
          log(etat, today, 'objectif_termine', { objectifId: o.id, titre: o.titre });
        } else {
          if (ancien === 'termine') o.termineLe = null;
          if (STATUTS.indexOf(nouveau) > STATUTS.indexOf(ancien)) {
            log(etat, today, 'objectif_avance', { objectifId: o.id, titre: o.titre });
          }
        }
      }
    });
    return o;
  }

  // Suppression douce : les semaines passées gardent l'objectif qu'elles avaient.
  function supprimerObjectif(etat, id, today) {
    var o = etat.objectifs.find(function (x) { return x.id === id; });
    if (o) o.supprimeLe = today;
    return o;
  }

  function actifs(etat) { return etat.objectifs.filter(function (o) { return !o.supprimeLe; }); }

  function objectifsAu(etat, date) {
    return etat.objectifs.filter(function (o) {
      return o.creeLe <= date && (!o.supprimeLe || o.supprimeLe > date);
    });
  }

  // Échéance telle qu'elle était à une date donnée.
  function echeanceAu(o, date) {
    var val = o.echeance;
    var h = (o.historique || []).filter(function (x) { return x.champ === 'echeance'; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h.forEach(function (x) { if (x.date > date) val = x.ancien; });
    return val;
  }

  function niveauUrgence(jours) {
    if (jours < 0) return 'retard';
    if (jours === 0) return 'aujourdhui';
    if (jours <= 7) return 'bientot';
    return 'plus_tard';
  }

  function urgences(etat, today) {
    return actifs(etat)
      .filter(function (o) { return o.statut !== 'termine' && o.echeance; })
      .map(function (o) {
        var j = diffDays(today, o.echeance);
        return { objectif: o, jours: j, niveau: niveauUrgence(j) };
      })
      .filter(function (x) { return x.niveau !== 'plus_tard'; })
      .sort(function (a, b) { return a.jours - b.jours; });
  }

  /* ---------- échanges groupés ---------- */
  function creerEchange(etat, data, today) {
    var e = {
      id: uid(),
      objectifId: data.objectifId || null,
      titre: data.titre,
      boite: data.boite || '',
      mailRef: data.mailRef || '',
      envoyeLe: data.envoyeLe || today,
      delaiRelance: data.delaiRelance || etat.reglages.delaiRelance,
      datesProposees: data.datesProposees || [],
      dateRetenue: null,
      destinataires: (data.personnes || []).map(function (pid) {
        return { personneId: pid, reponduLe: null, relances: [] };
      }),
      completeLe: null,
      modifsEnvoyeesLe: null
    };
    etat.echanges.push(e);
    log(etat, today, 'echange_cree', { echangeId: e.id, titre: e.titre });
    return e;
  }

  function statutEchange(e) {
    var repondus = e.destinataires.filter(function (d) { return d.reponduLe; });
    var attente = e.destinataires.filter(function (d) { return !d.reponduLe; });
    return {
      total: e.destinataires.length,
      repondus: repondus,
      attente: attente,
      complet: e.destinataires.length > 0 && attente.length === 0
    };
  }

  function dernierContact(e, d) {
    var r = (d.relances || []).slice().sort();
    return r.length ? r[r.length - 1] : e.envoyeLe;
  }

  function relanceDue(e, d, today) {
    if (d.reponduLe || e.modifsEnvoyeesLe) return false;
    return diffDays(dernierContact(e, d), today) >= (e.delaiRelance || 3);
  }

  function joursDepuisEnvoi(e, today) { return diffDays(e.envoyeLe, today); }

  function marquerReponse(etat, echangeId, personneId, date) {
    var e = etat.echanges.find(function (x) { return x.id === echangeId; });
    if (!e) return null;
    var d = e.destinataires.find(function (x) { return x.personneId === personneId; });
    if (!d || d.reponduLe) return e;
    d.reponduLe = date;
    log(etat, date, 'reponse_recue', { echangeId: e.id, personneId: personneId });
    if (statutEchange(e).complet && !e.completeLe) {
      e.completeLe = date;
      log(etat, date, 'echange_complet', { echangeId: e.id, titre: e.titre });
    }
    return e;
  }

  function annulerReponse(etat, echangeId, personneId) {
    var e = etat.echanges.find(function (x) { return x.id === echangeId; });
    if (!e) return null;
    var d = e.destinataires.find(function (x) { return x.personneId === personneId; });
    if (!d || !d.reponduLe) return e;
    var date = d.reponduLe;
    d.reponduLe = null;
    // on retire la trace de cette réponse pour garder des bilans exacts
    etat.journal = etat.journal.filter(function (j) {
      return !(j.type === 'reponse_recue' && j.echangeId === e.id && j.personneId === personneId && j.date === date);
    });
    if (e.completeLe && !statutEchange(e).complet) {
      etat.journal = etat.journal.filter(function (j) {
        return !(j.type === 'echange_complet' && j.echangeId === e.id && j.date === e.completeLe);
      });
      e.completeLe = null;
      e.modifsEnvoyeesLe = null;
    }
    return e;
  }

  function enregistrerRelance(etat, echangeId, personneId, date) {
    var e = etat.echanges.find(function (x) { return x.id === echangeId; });
    if (!e) return null;
    var d = e.destinataires.find(function (x) { return x.personneId === personneId; });
    if (!d || d.reponduLe) return e;
    d.relances.push(date);
    log(etat, date, 'relance_faite', { echangeId: e.id, personneId: personneId });
    return e;
  }

  // Bouton « j'ai reçu toutes les réponses » : marque les personnes restantes comme ayant répondu.
  function toutesReponsesRecues(etat, echangeId, date) {
    var e = etat.echanges.find(function (x) { return x.id === echangeId; });
    if (!e) return null;
    e.destinataires.forEach(function (d) {
      if (!d.reponduLe) marquerReponse(etat, echangeId, d.personneId, date);
    });
    return e;
  }

  function modificationsEnvoyees(etat, echangeId, date, dateRetenue) {
    var e = etat.echanges.find(function (x) { return x.id === echangeId; });
    if (!e || !statutEchange(e).complet) return e || null;
    e.modifsEnvoyeesLe = date;
    if (dateRetenue) e.dateRetenue = dateRetenue;
    log(etat, date, 'modifs_envoyees', { echangeId: e.id, titre: e.titre });
    return e;
  }

  function relancesEnAttente(etat, today) {
    var res = [];
    etat.echanges.forEach(function (e) {
      if (e.modifsEnvoyeesLe) return;
      e.destinataires.forEach(function (d) {
        if (d.reponduLe) return;
        res.push({
          echange: e, dest: d,
          jours: joursDepuisEnvoi(e, today),
          due: relanceDue(e, d, today)
        });
      });
    });
    return res.sort(function (a, b) { return (b.due - a.due) || (b.jours - a.jours); });
  }

  // Indicateur d'une personne : repondu / relance / pas_repondu / aucun
  function indicateurPersonne(etat, personneId, today) {
    var liste = [];
    etat.echanges.forEach(function (e) {
      var d = e.destinataires.find(function (x) { return x.personneId === personneId; });
      if (d) liste.push({ e: e, d: d });
    });
    if (!liste.length) return 'aucun';
    liste.sort(function (a, b) { return a.e.envoyeLe < b.e.envoyeLe ? 1 : -1; });
    var dernier = liste[0];
    if (dernier.d.reponduLe) return 'repondu';
    if (relanceDue(dernier.e, dernier.d, today)) return 'relance';
    return 'pas_repondu';
  }

  function dernierContactPersonne(etat, personneId) {
    var dates = [];
    etat.echanges.forEach(function (e) {
      var d = e.destinataires.find(function (x) { return x.personneId === personneId; });
      if (!d) return;
      dates.push(e.envoyeLe);
      (d.relances || []).forEach(function (r) { dates.push(r); });
      if (d.reponduLe) dates.push(d.reponduLe);
    });
    dates.sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  function relanceTexte(e, personne, objectif) {
    var prenom = personne ? personne.nom.split(' ')[0] : '';
    var sujet = e.titre || (objectif && objectif.titre) || 'ma demande';
    var dates = (e.datesProposees || []).filter(Boolean);
    var l = ['Bonjour ' + prenom + ',', '',
      'Je me permets de revenir vers vous au sujet de : ' + sujet + '.'];
    if (dates.length) l.push('Je vous avais proposé les dates suivantes : ' + dates.map(formatDateLongue).join(', ') + '.');
    l.push('Pourriez-vous me faire un retour dès que possible ? Cela me permettra de finaliser avec l\'ensemble des personnes concernées.',
      '', 'Merci d\'avance,', 'Fouad');
    return l.join('\n');
  }

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function formatDateLongue(s) {
    var d = new Date(utc(s));
    return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()];
  }

  /* ---------- bilans ---------- */
  function enAttenteAu(etat, date) {
    return etat.echanges.filter(function (e) {
      return e.envoyeLe <= date && e.destinataires.some(function (d) { return !d.reponduLe || d.reponduLe > date; });
    });
  }

  function bilanJour(etat, date, today) {
    var tenues = 0, nonTenues = 0, aVenir = 0;
    var prevues = objectifsAu(etat, date).filter(function (o) { return echeanceAu(o, date) === date; });
    prevues.forEach(function (o) {
      if (o.termineLe && o.termineLe <= date) tenues++;
      else if (date < today) nonTenues++;
      else aVenir++; // le jour n'est pas fini : pas encore évaluable
    });
    var ev = etat.journal.filter(function (j) { return j.date === date; });
    function n(t) { return ev.filter(function (j) { return j.type === t; }).length; }
    return {
      date: date,
      saisie: ev.length > 0 || prevues.length > 0,
      tenues: tenues, nonTenues: nonTenues, aVenir: aVenir,
      relances: n('relance_faite'),
      reponses: n('reponse_recue'),
      debloques: n('echange_complet'),
      avances: n('objectif_avance'),
      atteints: n('objectif_termine'),
      taux: ratio(tenues, tenues + nonTenues)
    };
  }

  function bilanSemaine(etat, debut, today) {
    var jours = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(debut, i);
      if (d <= today) jours.push(bilanJour(etat, d, today));
    }
    var actifsJ = jours.filter(function (j) { return j.saisie; });
    function somme(k) { return actifsJ.reduce(function (s, j) { return s + j[k]; }, 0); }
    var fin = addDays(debut, 6);
    var delais = [];
    etat.echanges.forEach(function (e) {
      e.destinataires.forEach(function (d) {
        if (d.reponduLe && d.reponduLe >= debut && d.reponduLe <= fin) delais.push(diffDays(e.envoyeLe, d.reponduLe));
      });
    });
    var t = somme('tenues'), nt = somme('nonTenues');
    var finEval = fin < today ? fin : today;
    return {
      debut: debut, fin: fin,
      joursSaisis: actifsJ.length,
      tenues: t, nonTenues: nt, taux: ratio(t, t + nt),
      relances: somme('relances'),
      reponses: somme('reponses'),
      debloques: somme('debloques'),
      avances: somme('avances'),
      atteints: somme('atteints'),
      delaiMoyen: delais.length ? delais.reduce(function (a, b) { return a + b; }, 0) / delais.length : null,
      nbReponsesDelai: delais.length,
      enAttente: enAttenteAu(etat, finEval).length
    };
  }

  function tendance(actuel, precedent) {
    if (actuel === null || actuel === undefined || precedent === null || precedent === undefined) return null;
    return actuel - precedent;
  }

  /* ---------- agenda (.ics) ---------- */
  function icsEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function genererICS(items) {
    var l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Suivi Commercial//FR', 'CALSCALE:GREGORIAN'];
    items.forEach(function (it) {
      var d = it.date.replace(/-/g, '');
      var fin = addDays(it.date, 1).replace(/-/g, '');
      l.push('BEGIN:VEVENT',
        'UID:' + (it.uid || uid()) + '@suivi-commercial',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
        'DTSTART;VALUE=DATE:' + d,
        'DTEND;VALUE=DATE:' + fin,
        'SUMMARY:' + icsEscape(it.titre));
      if (it.description) l.push('DESCRIPTION:' + icsEscape(it.description));
      l.push('END:VEVENT');
    });
    l.push('END:VCALENDAR');
    return l.join('\r\n') + '\r\n';
  }

  function datesAgenda(etat) {
    var items = [];
    actifs(etat).forEach(function (o) {
      if (o.echeance && o.statut !== 'termine') {
        items.push({ uid: 'obj-' + o.id, date: o.echeance, titre: 'Échéance : ' + o.titre, description: o.boite });
      }
    });
    etat.echanges.forEach(function (e) {
      if (e.dateRetenue) items.push({ uid: 'ret-' + e.id, date: e.dateRetenue, titre: 'Date retenue : ' + e.titre });
      else if (!e.modifsEnvoyeesLe) {
        (e.datesProposees || []).filter(Boolean).forEach(function (d, i) {
          items.push({ uid: 'prop-' + e.id + '-' + i, date: d, titre: 'Date proposée : ' + e.titre });
        });
      }
    });
    return items;
  }

  /* ---------- sauvegarde ---------- */
  function sauvegardeDue(etat, today) {
    var aDesDonnees = etat.objectifs.length + etat.echanges.length + etat.interlocuteurs.length > 0;
    if (!aDesDonnees) return false;
    var d = etat.reglages.dernierExport;
    return !d || diffDays(d, today) >= 14;
  }

  function importerEtat(texte) {
    var o;
    try { o = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n\'est pas une sauvegarde valide.'); }
    if (!o || typeof o !== 'object' || !Array.isArray(o.objectifs) || !Array.isArray(o.echanges) || !Array.isArray(o.interlocuteurs)) {
      throw new Error('Ce fichier n\'est pas une sauvegarde de cette application.');
    }
    var base = nouvelEtat();
    for (var k in base) if (!(k in o)) o[k] = base[k];
    o.reglages = Object.assign({}, base.reglages, o.reglages || {});
    if (!Array.isArray(o.journal)) o.journal = [];
    return o;
  }

  return {
    STATUTS: STATUTS, STATUT_LABEL: STATUT_LABEL, BOITES: BOITES,
    iso: iso, diffDays: diffDays, addDays: addDays, debutSemaine: debutSemaine, uid: uid, formatDateLongue: formatDateLongue,
    nouvelEtat: nouvelEtat,
    creerObjectif: creerObjectif, modifierObjectif: modifierObjectif, supprimerObjectif: supprimerObjectif,
    actifs: actifs, objectifsAu: objectifsAu, echeanceAu: echeanceAu, urgences: urgences, niveauUrgence: niveauUrgence,
    creerEchange: creerEchange, statutEchange: statutEchange, relanceDue: relanceDue, joursDepuisEnvoi: joursDepuisEnvoi,
    marquerReponse: marquerReponse, annulerReponse: annulerReponse, enregistrerRelance: enregistrerRelance,
    toutesReponsesRecues: toutesReponsesRecues, modificationsEnvoyees: modificationsEnvoyees,
    relancesEnAttente: relancesEnAttente, indicateurPersonne: indicateurPersonne,
    dernierContactPersonne: dernierContactPersonne, relanceTexte: relanceTexte,
    bilanJour: bilanJour, bilanSemaine: bilanSemaine, tendance: tendance, enAttenteAu: enAttenteAu,
    genererICS: genererICS, datesAgenda: datesAgenda,
    sauvegardeDue: sauvegardeDue, importerEtat: importerEtat
  };
});
