from fastapi.testclient import TestClient


def test_malleability_attack_produces_predicted_plaintext(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    message_int = 7

    r = client.post(
        "/api/security-demo/malleability",
        json={"n": n, "e": e, "d": d, "message_int": message_int, "blind_factor": 3},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["original_plaintext"] == message_int
    assert body["tampered_plaintext"] == (message_int * 3) % n
    assert body["expected_tampered_plaintext"] == body["tampered_plaintext"]
    assert body["matches_prediction"] is True
    # The attacker's view (ciphertext + blinding math) never touches d.
    assert body["original_ciphertext"] != body["tampered_ciphertext"]


def test_malleability_rejects_message_out_of_range(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post(
        "/api/security-demo/malleability",
        json={"n": kg["n"], "e": kg["e"], "d": kg["d"], "message_int": kg["n"] + 100, "blind_factor": 2},
    )
    assert r.status_code == 400


def test_malleability_rejects_blind_factor_below_two(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post(
        "/api/security-demo/malleability",
        json={"n": kg["n"], "e": kg["e"], "d": kg["d"], "message_int": 5, "blind_factor": 1},
    )
    assert r.status_code == 422


def _block_size_of(client: TestClient, n: int, e: int) -> int:
    return client.post("/api/rsa/encrypt", json={"message": "x", "n": n, "e": e}).json()["block_size_bytes"]


def test_block_substitution_splices_forged_block_undetected(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)  # spans multiple blocks, so block 0 is not the final block
    forged_text = ("EVIL" * block_size)[:block_size]  # fits exactly within this key's block size

    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": message, "block_index": 0, "forged_block_text": forged_text},
    )
    assert r.status_code == 200
    body = r.json()
    # The splice always succeeds -- no error field, no "sometimes caught" branch, unlike a
    # raw ciphertext bit-flip whose fate depends on the key's bit length modulo 8.
    assert body["original_plaintext"] == message
    assert body["tampered_plaintext"] != message
    assert body["tampered_plaintext"].startswith(forged_text)
    assert body["original_ciphertext"][0] != body["tampered_ciphertext"][0]
    # Only the targeted block changed.
    assert body["original_ciphertext"][1:] == body["tampered_ciphertext"][1:]
    assert body["forged_block_index"] == 0


def test_block_substitution_rejects_final_block_index(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)

    # Encrypting "A"*(block_size*3) produces 4 blocks (a full block of PKCS7 padding is
    # always appended); the last valid non-final index is 2.
    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": message, "block_index": 3, "forged_block_text": "x"},
    )
    assert r.status_code == 400


def test_block_substitution_rejects_forged_text_longer_than_block_size(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)

    r = client.post(
        "/api/security-demo/tamper",
        json={
            "n": n,
            "e": e,
            "d": d,
            "message": message,
            "block_index": 0,
            "forged_block_text": "x" * (block_size + 1),
        },
    )
    assert r.status_code == 400


def test_block_substitution_rejects_single_block_message(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]

    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": "h", "block_index": 0, "forged_block_text": "x"},
    )
    assert r.status_code == 400


def test_rate_limit_ping_trips_429_after_its_small_budget(client: TestClient) -> None:
    from backend.app.rate_limit import dashboard_demo_limiter

    for _ in range(dashboard_demo_limiter.max_requests):
        r = client.get("/api/security-demo/rate-limit-ping")
        assert r.status_code == 200
        assert r.json() == {"ok": True, "message": "request accepted"}

    r = client.get("/api/security-demo/rate-limit-ping")
    assert r.status_code == 429
    assert "Retry-After" in r.headers
