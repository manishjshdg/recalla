"""
Seed demo data for hackathon demonstration.
Creates realistic historical incidents, runbooks, and retains them in Hindsight.

Run: python seed_data.py
"""
import asyncio
import sys
import os

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.models.database import init_db, get_session_factory, Incident, Runbook, PostMortem
from app.hindsight.client import retain_memory, build_incident_memory_content, build_postmortem_memory_content
from datetime import datetime, timedelta
import random

SEED_INCIDENTS = [
    {
        "incident_id": "INC-2026-041",
        "service": "Payment API",
        "severity": "Critical",
        "status": "post_mortem",
        "symptoms": "503 errors, database connection timeout, payment transactions failing",
        "error_message": "FATAL: too many connections for role payment_service",
        "affected_component": "PostgreSQL connection pool",
        "deployment_version": "v2.4.1",
        "error_rate": 87.0,
        "additional_context": "Spike in traffic after marketing campaign, connections not being released properly",
        "root_cause": "Database connection pool exhaustion due to connection leak in async handler introduced in v2.4.1",
        "confidence": "High",
        "recommended_actions": [
            "Rollback to deployment v2.4.0",
            "Restart payment-api service pods",
            "Increase DB connection pool from 50 to 200",
            "Monitor DB connections via pg_stat_activity",
            "Verify connection release in new async handlers",
        ],
        "recommended_runbook": "payment-db-recovery",
        "resolution_notes": "Rolled back to v2.4.0, restarted services, temporarily increased pool size. Root cause: missing await on connection.close() in new async payment handler.",
        "recovery_time_minutes": 8,
        "detected_at": datetime.utcnow() - timedelta(days=45),
        "resolved_at": datetime.utcnow() - timedelta(days=45) + timedelta(minutes=8),
        "postmortem": {
            "incident_summary": "Critical payment service outage due to DB connection pool exhaustion",
            "root_cause": "Connection leak in async payment handler introduced in v2.4.1 — missing await on connection.close()",
            "what_happened": "After deploying v2.4.1, async payment handlers started accumulating unclosed connections. Under normal traffic this was masked, but the marketing campaign spike exposed the leak causing pool exhaustion within 12 minutes.",
            "resolution": "Immediate rollback to v2.4.0, service restart, temporary pool increase to 200. Fix: added proper async context manager for all DB connections in new handlers.",
            "failed_attempts": "Initially tried increasing pool size without rollback — insufficient fix",
            "runbook_used": "payment-db-recovery",
            "recovery_time_minutes": 8,
            "lessons_learned": "All async database handlers must use context managers. Pre-production load testing should simulate peak traffic. DB pool metrics must be in alerting.",
            "preventive_actions": "Added DB connection count to PagerDuty alerts. Code review checklist now requires async context manager review. Load testing pipeline added to CI/CD.",
        }
    },
    {
        "incident_id": "INC-2026-018",
        "service": "Payment API",
        "severity": "SEV-1",
        "status": "post_mortem",
        "symptoms": "High latency, intermittent 503 errors, DB query timeouts",
        "error_message": "connection pool timeout - exceeded max_overflow limit",
        "affected_component": "SQLAlchemy connection pool",
        "deployment_version": "v2.3.0",
        "error_rate": 34.0,
        "additional_context": "Occurred during database maintenance window",
        "root_cause": "DB connection pool misconfiguration after infrastructure upgrade — max_overflow too low for new server capacity",
        "confidence": "High",
        "recommended_actions": [
            "Check current pool configuration",
            "Increase max_overflow parameter",
            "Restart application services",
            "Verify DB server connection limits",
        ],
        "recommended_runbook": "payment-db-recovery",
        "resolution_notes": "Increased max_overflow from 10 to 100, matched to new DB server capacity",
        "recovery_time_minutes": 22,
        "detected_at": datetime.utcnow() - timedelta(days=120),
        "resolved_at": datetime.utcnow() - timedelta(days=120) + timedelta(minutes=22),
        "postmortem": {
            "incident_summary": "Payment API degradation during DB infrastructure upgrade",
            "root_cause": "Connection pool max_overflow setting not updated after DB server upgrade",
            "what_happened": "DB server was upgraded to a larger instance but application pool settings remained at old limits, causing pool overflow during normal traffic",
            "resolution": "Updated max_overflow from 10 to 100 in application config. Deployed config update without service restart.",
            "failed_attempts": "Attempted service restart before finding root cause — extended downtime",
            "runbook_used": "payment-db-recovery",
            "recovery_time_minutes": 22,
            "lessons_learned": "Infrastructure changes must be accompanied by application configuration review. Pool settings should be proportional to DB server capacity.",
            "preventive_actions": "Created infrastructure change checklist that includes application config review. DB pool settings now documented in runbook.",
        }
    },
    {
        "incident_id": "INC-2025-092",
        "service": "Auth Service",
        "severity": "Critical",
        "status": "post_mortem",
        "symptoms": "Login failures, JWT token validation errors, 401 responses across all services",
        "error_message": "JWT signature verification failed: key not found",
        "affected_component": "JWT secret rotation mechanism",
        "deployment_version": "v1.8.0",
        "error_rate": 100.0,
        "additional_context": "Occurred after scheduled secret rotation",
        "root_cause": "JWT secret rotation deployed without grace period — old tokens invalidated immediately causing 100% auth failure",
        "confidence": "High",
        "recommended_actions": [
            "Rollback to previous JWT secret",
            "Implement dual-key validation (accept both old and new secret during transition)",
            "Issue new tokens after grace period",
        ],
        "recommended_runbook": "auth-jwt-recovery",
        "resolution_notes": "Rolled back secret rotation, implemented dual-key validation, planned gradual migration over 24h",
        "recovery_time_minutes": 15,
        "detected_at": datetime.utcnow() - timedelta(days=180),
        "resolved_at": datetime.utcnow() - timedelta(days=180) + timedelta(minutes=15),
        "postmortem": {
            "incident_summary": "Complete auth outage due to JWT secret rotation without grace period",
            "root_cause": "JWT secret rotation mechanism did not implement token migration grace period",
            "what_happened": "Scheduled secret rotation immediately invalidated all existing tokens, causing 100% authentication failures across all services that relied on auth service",
            "resolution": "Emergency rollback of secret, temporary dual-key validation added. Full rotation completed over 24 hours with grace period.",
            "failed_attempts": "Initial attempt to force re-login all users failed due to volume",
            "runbook_used": "auth-jwt-recovery",
            "recovery_time_minutes": 15,
            "lessons_learned": "Secret rotations must always include grace period for existing tokens. Never use hard cutover for JWT secrets in production.",
            "preventive_actions": "Auth runbook updated. Dual-key validation now built into rotation process. Staged rollout added for secret changes.",
        }
    },
    {
        "incident_id": "INC-2025-071",
        "service": "API Gateway",
        "severity": "High",
        "status": "post_mortem",
        "symptoms": "Rate limiting errors across all services, upstream timeout failures",
        "error_message": "upstream connect error or disconnect/reset before headers. reset reason: connection timeout",
        "affected_component": "NGINX upstream configuration",
        "deployment_version": "gateway-v3.2.0",
        "error_rate": 45.0,
        "additional_context": "After scaling up backend services",
        "root_cause": "API gateway upstream timeout too short after backend services scaled up — new instances took longer to warm up",
        "confidence": "Medium",
        "recommended_actions": [
            "Increase upstream connection timeout",
            "Add health check grace period for new instances",
            "Configure slow start for new pods",
        ],
        "recommended_runbook": "gateway-timeout-recovery",
        "resolution_notes": "Increased proxy_read_timeout from 30s to 120s, added 60s slow-start for new pods",
        "recovery_time_minutes": 35,
        "detected_at": datetime.utcnow() - timedelta(days=220),
        "resolved_at": datetime.utcnow() - timedelta(days=220) + timedelta(minutes=35),
        "postmortem": {
            "incident_summary": "API gateway timeout errors after backend scaling operation",
            "root_cause": "Default upstream timeout insufficient for larger backend instances that require longer JVM warm-up time",
            "what_happened": "During a scale-up event, new JVM-based service instances were added to rotation before completing warm-up. Gateway timeouts to these cold instances caused cascading failures.",
            "resolution": "Increased upstream timeout, added slow-start configuration for new instances, implemented readiness probes.",
            "failed_attempts": "Rolling back scaling operation worsened load on existing instances temporarily",
            "runbook_used": "gateway-timeout-recovery",
            "recovery_time_minutes": 35,
            "lessons_learned": "JVM services require warm-up period before taking traffic. Readiness probes must be configured for all services. Slow-start should be default for scale-out events.",
            "preventive_actions": "Added readiness probes to all JVM services. Slow-start now configured in service mesh. Scaling playbook updated.",
        }
    },
    {
        "incident_id": "INC-2025-055",
        "service": "User Service",
        "severity": "SEV-2",
        "status": "post_mortem",
        "symptoms": "User profile updates failing, 500 errors, database write timeouts",
        "error_message": "deadlock detected while trying to get lock on relation users",
        "affected_component": "PostgreSQL user table",
        "deployment_version": "user-service-v4.1.0",
        "error_rate": 28.0,
        "additional_context": "Running bulk migration job alongside production traffic",
        "root_cause": "Database deadlock between bulk migration job and production write operations on users table",
        "confidence": "High",
        "recommended_actions": [
            "Stop bulk migration job immediately",
            "Kill long-running transactions",
            "Schedule migration for off-peak hours",
        ],
        "recommended_runbook": "db-deadlock-resolution",
        "resolution_notes": "Killed migration job, waited for deadlocks to clear, rescheduled migration for 2am",
        "recovery_time_minutes": 18,
        "detected_at": datetime.utcnow() - timedelta(days=280),
        "resolved_at": datetime.utcnow() - timedelta(days=280) + timedelta(minutes=18),
        "postmortem": {
            "incident_summary": "User service degradation due to database deadlocks during bulk migration",
            "root_cause": "Bulk migration job ran concurrently with production traffic without proper locking strategy",
            "what_happened": "A bulk user data migration job was initiated during business hours. The job held row-level locks that conflicted with production write operations, causing cascading deadlocks.",
            "resolution": "Terminated migration job, waited for deadlock resolution, verified data consistency, rescheduled migration for off-peak hours with proper rate limiting.",
            "failed_attempts": "Tried to pause migration instead of stop — insufficient, deadlocks continued",
            "runbook_used": "db-deadlock-resolution",
            "recovery_time_minutes": 18,
            "lessons_learned": "Bulk data operations must never run during business hours without proper lock management. Migration jobs should use advisory locks and rate limiting.",
            "preventive_actions": "Created production change policy requiring off-peak for bulk operations. Added migration job to maintenance window scheduler.",
        }
    },
]

SEED_RUNBOOKS = [
    {
        "name": "payment-db-recovery",
        "service": "Payment API",
        "purpose": "Resolve database connection pool exhaustion and related database connectivity issues for the Payment API",
        "steps": [
            "Check current DB connection count: SELECT count(*) FROM pg_stat_activity WHERE datname = 'payments'",
            "If connections > 80% of max_connections, proceed with rollback",
            "Identify the problematic deployment: kubectl rollout history deploy/payment-api",
            "Rollback to previous stable version: kubectl rollout undo deploy/payment-api",
            "Restart payment service pods: kubectl rollout restart deploy/payment-api",
            "Verify connection count drops below 50% within 2 minutes",
            "Increase pool size if needed: UPDATE pool_config SET max_connections = 200",
            "Monitor error rate via Datadog dashboard for 10 minutes",
            "If error rate < 1%, mark as mitigated and begin post-mortem",
        ],
        "warnings": [
            "WARNING: Rollback may cause brief service interruption (< 30 seconds)",
            "WARNING: Increasing pool size requires DB server to have sufficient capacity",
            "CAUTION: Do not increase pool above 500 without DBA approval",
        ],
        "success_count": 8,
        "total_uses": 9,
    },
    {
        "name": "auth-jwt-recovery",
        "service": "Auth Service",
        "purpose": "Recover from JWT token validation failures and secret rotation issues",
        "steps": [
            "Verify authentication failure rate in Datadog: auth.failures > 50%",
            "Check recent secret rotations in audit log",
            "If rotation was recent: temporarily enable dual-key validation in auth config",
            "Deploy auth service with ACCEPT_OLD_SECRET=true flag",
            "Monitor authentication success rate recovery",
            "Once rate > 95%, begin phased migration to new secret",
            "Disable dual-key validation after all tokens expired (typically 24h)",
            "Document the rotation timing issue in post-mortem",
        ],
        "warnings": [
            "WARNING: Never reuse a compromised JWT secret",
            "WARNING: Dual-key validation increases attack surface temporarily",
            "CAUTION: Coordinate with security team before any secret rollback",
        ],
        "success_count": 3,
        "total_uses": 3,
    },
    {
        "name": "gateway-timeout-recovery",
        "service": "API Gateway",
        "purpose": "Resolve API gateway timeout errors during scaling or deployment events",
        "steps": [
            "Check NGINX error logs: kubectl logs -l app=api-gateway | grep 'upstream timeout'",
            "Identify which upstream services are timing out",
            "Check if recent scaling event occurred: kubectl get events | grep Scaled",
            "If new pods recently added, check readiness probe status",
            "Increase upstream timeout temporarily: nginx.conf proxy_read_timeout 120s",
            "Apply config without reload if possible via API",
            "Add slow-start for new instances if JVM-based services involved",
            "Monitor success rate recovery over 10 minutes",
        ],
        "warnings": [
            "WARNING: Increasing timeouts may mask underlying performance issues",
            "CAUTION: Do not set timeouts above 300 seconds without investigating root cause",
        ],
        "success_count": 5,
        "total_uses": 6,
    },
    {
        "name": "db-deadlock-resolution",
        "service": "Database",
        "purpose": "Resolve database deadlocks affecting production operations",
        "steps": [
            "Identify deadlocked queries: SELECT * FROM pg_locks WHERE NOT granted",
            "Find the blocking PID: SELECT pg_blocking_pids(pid) FROM pg_stat_activity WHERE NOT granted",
            "Terminate long-running bulk jobs first: SELECT pg_terminate_backend(pid) WHERE ...",
            "Kill remaining deadlocked queries if needed",
            "Verify pg_locks clears within 30 seconds",
            "Check application error rates recover",
            "Identify the batch job or migration that caused the conflict",
            "Reschedule conflicting jobs to maintenance window",
        ],
        "warnings": [
            "WARNING: Terminating backend processes may cause data loss for in-flight transactions",
            "WARNING: Always terminate batch/migration jobs before production transactions",
            "CAUTION: Verify data consistency after resolving deadlocks",
        ],
        "success_count": 4,
        "total_uses": 5,
    },
]


async def seed_database():
    """Seed incidents and runbooks to the database."""
    await init_db()
    session_factory = get_session_factory()
    
    async with session_factory() as session:
        print("🌱 Seeding runbooks...")
        for rb_data in SEED_RUNBOOKS:
            from sqlalchemy import select
            result = await session.execute(select(Runbook).where(Runbook.name == rb_data["name"]))
            existing = result.scalar_one_or_none()
            if not existing:
                runbook = Runbook(**rb_data)
                session.add(runbook)
        await session.commit()
        print(f"✅ Seeded {len(SEED_RUNBOOKS)} runbooks")
        
        print("🌱 Seeding incidents...")
        for inc_data in SEED_INCIDENTS:
            from sqlalchemy import select
            result = await session.execute(select(Incident).where(Incident.incident_id == inc_data["incident_id"]))
            existing = result.scalar_one_or_none()
            postmortem_data = inc_data.pop("postmortem", None)
            if not existing:
                incident = Incident(**inc_data, retained_in_hindsight=True)
                session.add(incident)
                await session.flush()
                
                if postmortem_data:
                    postmortem = PostMortem(incident_id=incident.id, **postmortem_data, saved_to_hindsight=True)
                    session.add(postmortem)
            else:
                existing.retained_in_hindsight = True
                if postmortem_data:
                    pm_res = await session.execute(select(PostMortem).where(PostMortem.incident_id == existing.id))
                    pm = pm_res.scalar_one_or_none()
                    if pm:
                        pm.saved_to_hindsight = True
            
            inc_data["postmortem"] = postmortem_data  # restore
        
        await session.commit()
        print(f"✅ Seeded {len(SEED_INCIDENTS)} incidents")


async def seed_hindsight():
    """Retain all seed incidents in Hindsight memory."""
    print("\n🧠 Retaining incidents in Hindsight memory...")
    
    for inc_data in SEED_INCIDENTS:
        postmortem_data = inc_data.get("postmortem", {})
        
        # Retain the incident itself
        content = build_incident_memory_content(
            incident_id=inc_data["incident_id"],
            service=inc_data["service"],
            severity=inc_data["severity"],
            symptoms=inc_data["symptoms"],
            root_cause=inc_data.get("root_cause"),
            resolution=inc_data.get("resolution_notes"),
            runbook=inc_data.get("recommended_runbook"),
            recovery_time_minutes=inc_data.get("recovery_time_minutes"),
            error_rate=inc_data.get("error_rate"),
            deployment_version=inc_data.get("deployment_version"),
            additional_context=inc_data.get("additional_context"),
        )
        
        success = await retain_memory(content)
        status = "✅" if success else "❌"
        print(f"  {status} Retained: {inc_data['incident_id']} - {inc_data['service']}")
        
        # Retain the post-mortem (this is the key learning)
        if postmortem_data:
            pm_content = build_postmortem_memory_content(
                incident_id=inc_data["incident_id"],
                service=inc_data["service"],
                root_cause=postmortem_data["root_cause"],
                what_happened=postmortem_data["what_happened"],
                resolution=postmortem_data["resolution"],
                lessons_learned=postmortem_data["lessons_learned"],
                runbook_used=postmortem_data.get("runbook_used"),
                recovery_time_minutes=postmortem_data.get("recovery_time_minutes"),
                preventive_actions=postmortem_data.get("preventive_actions"),
                failed_attempts=postmortem_data.get("failed_attempts"),
            )
            
            success = await retain_memory(pm_content)
            status = "✅" if success else "❌"
            print(f"  {status} Post-mortem: {inc_data['incident_id']} lessons retained")
    
    print(f"\n🧠 Hindsight memory seeded with {len(SEED_INCIDENTS) * 2} memory entries")


async def main():
    print("=" * 60)
    print("🚀 Incident Response Agent — Demo Data Seeder")
    print("=" * 60)
    
    await seed_database()
    
    # Try to seed Hindsight (may fail if server not running)
    try:
        await seed_hindsight()
    except Exception as e:
        print(f"\n⚠️  Hindsight seeding skipped: {e}")
        print("   Start the Hindsight server and run again to populate memory.")
    
    print("\n" + "=" * 60)
    print("✨ Demo data ready! Start the backend with: uvicorn app.main:app --reload")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
