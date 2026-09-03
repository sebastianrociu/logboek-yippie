/* Nep-dataset voor de portaal-demo. Geen echte gegevens.
   Wordt geladen door index.html (login) en dashboard.html. */
window.YIPPIE_DEMO = {
  // Snelkeuze-accounts op het loginscherm.
  accounts: {
    sanne:  { key: "sanne",  naam: "Sanne Bakker",  email: "sanne@yippievoordeklas.nl",   rol: "yippie", wiskundeschool: true  },
    noor:   { key: "noor",   naam: "Noor Visser",   email: "noor@yippievoordeklas.nl",    rol: "yippie", wiskundeschool: false },
    mentor: { key: "mentor", naam: "M. de Wit",     email: "m.dewit@helenparkhurst.nl",   rol: "mentor", wiskundeschool: true  }
  },

  // Rooster per account. dag: 0 = maandag ... 6 = zondag. Herhaalt zich elke week.
  rooster: {
    sanne: [
      { dag: 0, van: "15:30", tot: "17:30", les: "Wiskundeschool",   plaats: "Helen Parkhurst, lokaal 2.14" },
      { dag: 2, van: "15:30", tot: "17:30", les: "Wiskundeschool",   plaats: "Helen Parkhurst, lokaal 2.14" },
      { dag: 3, van: "14:00", tot: "16:00", les: "Bijles Nederlands", plaats: "Montessori Lyceum" }
    ],
    noor: [
      { dag: 1, van: "15:00", tot: "17:00", les: "Bijles Engels", plaats: "Spinoza Lyceum" },
      { dag: 4, van: "15:00", tot: "17:00", les: "Bijles Engels", plaats: "Spinoza Lyceum" }
    ],
    mentor: []
  },

  // Waar het logboek toegang toe geeft.
  LES_MET_LOGBOEK: "Wiskundeschool"
};
