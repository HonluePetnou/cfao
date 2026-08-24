// Liste normalisée des corps d'état — partagée entre la création d'équipement
// (Super Admin) et la création de ticket (Demandeur), pour que le filtrage en
// cascade équipement/corps d'état sur le formulaire de ticket fonctionne :
// un équipement créé sans corps d'état n'apparaît jamais dans ce filtre.
export const CORPS_ETAT_LIST = [
  "Climatisation / Ventilation",
  "Électricité courant fort",
  "Électricité courant faible",
  "Équipement de production",
  "Froid alimentaire",
  "Génie civil / Bâtiment",
  "Mécanique",
  "Moyens de secours",
  "Plomberie industrielle",
  "Plomberie sanitaire",
];
