package com.example.data.repository

import com.example.base.FirestoreEmulatorTestBase
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VitaRepositoryRuleTest : FirestoreEmulatorTestBase() {

    @Test
    fun createAndObserveSupplement_authenticatedOwner_emitsRealtimeUpdate() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = VitaRepository(firestore)

        val createResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.createSupplement(
                name = "Omega 3 Balık Yağı",
                dosage = "1000 mg",
                category = "Takviye",
                timeOfDay = "Ogle",
                stockCount = 60L,
                notes = "Tok karnına"
            )
        }
        assertTrue(createResult.isSuccess)
        val supplementId = createResult.getOrThrow()
        assertTrue(supplementId.isNotEmpty())

        val emitted = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeSupplements(aliceUid).first { list ->
                list.any { it.id == supplementId }
            }
        }
        assertTrue(emitted.any { it.id == supplementId && it.name == "Omega 3 Balık Yağı" })
    }

    @Test
    fun createAndObserveVitalLog_authenticatedOwner_emitsRealtimeUpdate() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val repository = VitaRepository(firestore)

        val createResult = withTimeout(DEFAULT_TIMEOUT_MS) {
            repository.createVitalLog(
                type = "Su",
                title = "Su Tüketimi",
                primaryValue = 250L,
                secondaryValue = 0L,
                unit = "ml",
                note = "1 Bardak"
            )
        }
        assertTrue(createResult.isSuccess)
        val logId = createResult.getOrThrow()

        val emitted = withTimeout(FLOW_TIMEOUT_MS) {
            repository.observeVitalLogs(aliceUid).first { list ->
                list.any { it.id == logId }
            }
        }
        assertTrue(emitted.any { it.id == logId && it.primaryValue == 250L })
    }

    @Test
    fun getSupplementById_crossUserAccess_failsWithPermissionDenied() = runBlocking {
        val aliceUid = signInTestUser(ALICE_EMAIL)
        val aliceRepo = VitaRepository(firestore)
        val suppId = withTimeout(DEFAULT_TIMEOUT_MS) {
            aliceRepo.createSupplement(
                name = "Magnezyum",
                dosage = "200 mg",
                category = "Mineral",
                timeOfDay = "Gece",
                stockCount = 30L
            ).getOrThrow()
        }

        signInTestUser(BOB_EMAIL)
        val bobRepo = VitaRepository(firestore)
        val result = withTimeout(DEFAULT_TIMEOUT_MS) {
            bobRepo.getSupplementById(aliceUid, suppId)
        }
        assertTrue(result.isFailure)
        val firestoreException = result.exceptionOrNull()?.unwrapFirestoreException()
        assertNotNull(firestoreException)
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, firestoreException?.code)
    }

    @Test
    fun observeSupplements_unauthenticatedUser_failsWithPermissionDenied() = runBlocking {
        auth.signOut()
        val repository = VitaRepository(firestore)

        var caughtException: Throwable? = null
        try {
            withTimeout(FLOW_TIMEOUT_MS) {
                repository.observeSupplements("unauth_user_123").first()
            }
        } catch (e: Throwable) {
            caughtException = e
        }
        assertNotNull(caughtException)
        val firestoreException = caughtException?.unwrapFirestoreException()
        assertNotNull("Expected FirebaseFirestoreException, got $caughtException", firestoreException)
        assertEquals(FirebaseFirestoreException.Code.PERMISSION_DENIED, firestoreException?.code)
    }

    private companion object {
        const val ALICE_EMAIL = "alice@vitatakip.test"
        const val BOB_EMAIL = "bob@vitatakip.test"
        const val DEFAULT_TIMEOUT_MS = 5000L
        const val FLOW_TIMEOUT_MS = 3000L
    }
}
