def test_keygen_returns_a_valid_keypair(client):
    r = client.post("/api/rsa/keygen", json={"bits": 16})
    assert r.status_code == 200
    body = r.json()
    assert body["p"] * body["q"] == body["n"]
    assert (body["p"] - 1) * (body["q"] - 1) == body["phi"]
    assert (body["e"] * body["d"]) % body["phi"] == 1


def test_encrypt_decrypt_round_trip(client):
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    enc = client.post("/api/rsa/encrypt", json={"message": "hello world", "n": kg["n"], "e": kg["e"]})
    assert enc.status_code == 200
    ciphertext = enc.json()["ciphertext"]

    dec = client.post("/api/rsa/decrypt", json={"ciphertext": ciphertext, "n": kg["n"], "d": kg["d"]})
    assert dec.status_code == 200
    assert dec.json()["plaintext"] == "hello world"


def test_keygen_rejects_bits_above_limit(client):
    r = client.post("/api/rsa/keygen", json={"bits": 999})
    assert r.status_code == 422


def test_keygen_rejects_bits_below_limit(client):
    r = client.post("/api/rsa/keygen", json={"bits": 1})
    assert r.status_code == 422


def test_encrypt_rejects_message_over_max_length(client):
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post("/api/rsa/encrypt", json={"message": "x" * 10_000, "n": kg["n"], "e": kg["e"]})
    assert r.status_code == 422


def test_encrypt_on_modulus_too_small_gives_clean_error_not_a_traceback(client):
    # n=35 (5*7) can't hold even one byte -- rsa.core._block_size raises ValueError, which
    # the AppError/ValueError handler must turn into a clean 400, not a 500 with a traceback.
    r = client.post("/api/rsa/encrypt", json={"message": "hi", "n": 35, "e": 5})
    assert r.status_code == 400
    assert "traceback" not in r.json()["detail"].lower()
    assert "Traceback" not in str(r.content)
