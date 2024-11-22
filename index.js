require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Connexion à PostgreSQL
const pool = new Pool({
  user: process.env.DATABASE_USER,
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT,
});

// Création de la table articles (à exécuter une seule fois)
pool
  .query(
    `
  CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL
  )
`
  )
  .then(() => console.log("La table articles a été créée ou existe déjà."))
  .catch((err) =>
    console.error(
      `Erreur lors de la création de la table articles : ${err.message}`
    )
  );

// Middleware pour parser le JSON
app.use(express.json());

// Vérifie l'existence d'un article par son titre
const verifyTitleUnicity = async (title) => {
  const result = await pool.query(
    "SELECT COUNT(id) AS count FROM articles WHERE title=$1",
    [title]
  );
  return result.rows[0].count > 0;
};

// Routes
app.get("/", (req, res) => {
  res.send("Hello from your Articles API!");
});

app.get("/articles", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM articles ORDER BY id ASC");
    if (result.rows.length === 0) {
      throw new Error("La table articles est vide.");
    }
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/articles", async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (await verifyTitleUnicity(title)) {
      throw new Error("Un article avec ce titre existe déjà");
    }
    const result = await pool.query(
      "INSERT INTO articles(title, content, author) VALUES($1, $2, $3) RETURNING *",
      [title, content, author]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/articles/edit", async (req, res) => {
  try {
    const { id, title, content, author } = req.body;

    if (!id) {
      throw new Error("L'ID de l'article est requis");
    }

    const result = await pool.query(
      "UPDATE articles SET title=$2, content=$3, author=$4 WHERE id=$1 RETURNING *",
      [id, title, content, author]
    );
    if (result.rows.length === 0) {
      throw new Error("Aucun article trouvé");
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch("/articles/edit/title", async (req, res) => {
  try {
    const { id, title } = req.body;

    if (!id || !title) {
      throw new Error("L'ID et le nouveau titre sont requis");
    }

    const result = await pool.query(
      "UPDATE articles SET title=$2 WHERE id=$1 RETURNING *",
      [id, title]
    );
    if (result.rows.length === 0) {
      throw new Error("Aucun article trouvé");
    }
    res.status(200).json({
      message: "Le titre de l'article a été modifié",
      result: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.delete("/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM articles WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Aucun article trouvé" });
    }
    res.status(200).json({
      message: "L'article a été supprimé",
      deletedArticle: result.rows[0],
    });
  } catch (err) {
    res
      .status(500)
      .json({
        message: `Erreur suppression: ${err.message}`,
      });
  }
});
app.listen(port, () => console.log(`Le serveur écoute sur le port ${port}.`));
