/**
 * @fileoverview Tests for Permission enum and utilities
 */

import { describe, it, expect } from 'vitest'
import { Permission, PermissionUtils } from '../../../security/domain/values/Permission.js'

describe('Permission', () => {
  describe('enum values', () => {
    it('should have all expected permission values', () => {
      expect(Permission.SEND_MESSAGE).toBe('send_message')
      expect(Permission.READ_MESSAGE).toBe('read_message')
      expect(Permission.READ_OWN_MESSAGES).toBe('read_own_messages')
      expect(Permission.RESPOND_MESSAGE).toBe('respond_message')
      expect(Permission.SEARCH_MESSAGES).toBe('search_messages')
      expect(Permission.REGISTER_PARTICIPANT).toBe('register_participant')
      expect(Permission.MANAGE_PARTICIPANTS).toBe('manage_participants')
      expect(Permission.VIEW_PARTICIPANT_INFO).toBe('view_participant_info')
      expect(Permission.COMPACT_THREADS).toBe('compact_threads')
      expect(Permission.ARCHIVE_MESSAGES).toBe('archive_messages')
      expect(Permission.VIEW_SYSTEM_STATS).toBe('view_system_stats')
      expect(Permission.VIEW_AUDIT_LOGS).toBe('view_audit_logs')
      expect(Permission.MANAGE_SECURITY_POLICIES).toBe('manage_security_policies')
      expect(Permission.SYSTEM_ADMIN).toBe('system_admin')
    })
  })

  describe('PermissionUtils.expandPermissions', () => {
    it('should expand SYSTEM_ADMIN permissions correctly', () => {
      const directPermissions = new Set([Permission.SYSTEM_ADMIN])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.has(Permission.SYSTEM_ADMIN)).toBe(true)
      expect(expanded.has(Permission.MANAGE_PARTICIPANTS)).toBe(true)
      expect(expanded.has(Permission.MANAGE_SECURITY_POLICIES)).toBe(true)
      expect(expanded.has(Permission.VIEW_AUDIT_LOGS)).toBe(true)
      expect(expanded.has(Permission.COMPACT_THREADS)).toBe(true)
      expect(expanded.has(Permission.ARCHIVE_MESSAGES)).toBe(true)
      expect(expanded.has(Permission.VIEW_SYSTEM_STATS)).toBe(true)
      expect(expanded.has(Permission.REGISTER_PARTICIPANT)).toBe(true)
      expect(expanded.has(Permission.VIEW_PARTICIPANT_INFO)).toBe(true)
    })

    it('should expand MANAGE_PARTICIPANTS permissions correctly', () => {
      const directPermissions = new Set([Permission.MANAGE_PARTICIPANTS])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.has(Permission.MANAGE_PARTICIPANTS)).toBe(true)
      expect(expanded.has(Permission.REGISTER_PARTICIPANT)).toBe(true)
      expect(expanded.has(Permission.VIEW_PARTICIPANT_INFO)).toBe(true)
      expect(expanded.has(Permission.SYSTEM_ADMIN)).toBe(false)
    })

    it('should expand SEND_MESSAGE permissions correctly', () => {
      const directPermissions = new Set([Permission.SEND_MESSAGE])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.has(Permission.SEND_MESSAGE)).toBe(true)
      expect(expanded.has(Permission.READ_OWN_MESSAGES)).toBe(true)
      expect(expanded.has(Permission.READ_MESSAGE)).toBe(false)
    })

    it('should handle multiple permissions', () => {
      const directPermissions = new Set([
        Permission.SEND_MESSAGE,
        Permission.MANAGE_PARTICIPANTS
      ])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.has(Permission.SEND_MESSAGE)).toBe(true)
      expect(expanded.has(Permission.READ_OWN_MESSAGES)).toBe(true)
      expect(expanded.has(Permission.MANAGE_PARTICIPANTS)).toBe(true)
      expect(expanded.has(Permission.REGISTER_PARTICIPANT)).toBe(true)
      expect(expanded.has(Permission.VIEW_PARTICIPANT_INFO)).toBe(true)
    })

    it('should handle permissions with no hierarchy', () => {
      const directPermissions = new Set([Permission.READ_MESSAGE])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.has(Permission.READ_MESSAGE)).toBe(true)
      expect(expanded.size).toBe(1)
    })

    it('should handle empty permission set', () => {
      const directPermissions = new Set<Permission>()
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      expect(expanded.size).toBe(0)
    })

    it('should not duplicate permissions', () => {
      const directPermissions = new Set([
        Permission.SYSTEM_ADMIN,
        Permission.MANAGE_PARTICIPANTS // Already implied by SYSTEM_ADMIN
      ])
      const expanded = PermissionUtils.expandPermissions(directPermissions)

      // Count should not include duplicates
      const expectedPermissions = [
        Permission.SYSTEM_ADMIN,
        Permission.MANAGE_PARTICIPANTS,
        Permission.MANAGE_SECURITY_POLICIES,
        Permission.VIEW_AUDIT_LOGS,
        Permission.COMPACT_THREADS,
        Permission.ARCHIVE_MESSAGES,
        Permission.VIEW_SYSTEM_STATS,
        Permission.REGISTER_PARTICIPANT,
        Permission.VIEW_PARTICIPANT_INFO
      ]

      expect(expanded.size).toBe(expectedPermissions.length)
      expectedPermissions.forEach(permission => {
        expect(expanded.has(permission)).toBe(true)
      })
    })
  })

  describe('PermissionUtils.hasPermission', () => {
    it('should return true for direct permissions', () => {
      const userPermissions = new Set([Permission.SEND_MESSAGE])
      
      expect(PermissionUtils.hasPermission(userPermissions, Permission.SEND_MESSAGE)).toBe(true)
    })

    it('should return true for implied permissions', () => {
      const userPermissions = new Set([Permission.SEND_MESSAGE])
      
      expect(PermissionUtils.hasPermission(userPermissions, Permission.READ_OWN_MESSAGES)).toBe(true)
    })

    it('should return false for missing permissions', () => {
      const userPermissions = new Set([Permission.SEND_MESSAGE])
      
      expect(PermissionUtils.hasPermission(userPermissions, Permission.READ_MESSAGE)).toBe(false)
    })

    it('should work with admin permissions', () => {
      const adminPermissions = new Set([Permission.SYSTEM_ADMIN])
      
      expect(PermissionUtils.hasPermission(adminPermissions, Permission.MANAGE_PARTICIPANTS)).toBe(true)
      expect(PermissionUtils.hasPermission(adminPermissions, Permission.VIEW_AUDIT_LOGS)).toBe(true)
      expect(PermissionUtils.hasPermission(adminPermissions, Permission.REGISTER_PARTICIPANT)).toBe(true)
    })

    it('should handle empty permission set', () => {
      const emptyPermissions = new Set<Permission>()
      
      expect(PermissionUtils.hasPermission(emptyPermissions, Permission.SEND_MESSAGE)).toBe(false)
    })
  })

  describe('PermissionUtils.getPermissionRiskLevel', () => {
    it('should classify LOW risk permissions correctly', () => {
      const lowRiskPermissions = [
        Permission.READ_OWN_MESSAGES,
        Permission.READ_MESSAGE
      ]

      lowRiskPermissions.forEach(permission => {
        expect(PermissionUtils.getPermissionRiskLevel(permission)).toBe('LOW')
      })
    })

    it('should classify MEDIUM risk permissions correctly', () => {
      const mediumRiskPermissions = [
        Permission.SEND_MESSAGE,
        Permission.RESPOND_MESSAGE,
        Permission.SEARCH_MESSAGES,
        Permission.VIEW_PARTICIPANT_INFO,
        Permission.VIEW_SYSTEM_STATS
      ]

      mediumRiskPermissions.forEach(permission => {
        expect(PermissionUtils.getPermissionRiskLevel(permission)).toBe('MEDIUM')
      })
    })

    it('should classify HIGH risk permissions correctly', () => {
      const highRiskPermissions = [
        Permission.REGISTER_PARTICIPANT,
        Permission.COMPACT_THREADS,
        Permission.ARCHIVE_MESSAGES,
        Permission.MANAGE_PARTICIPANTS,
        Permission.VIEW_AUDIT_LOGS
      ]

      highRiskPermissions.forEach(permission => {
        expect(PermissionUtils.getPermissionRiskLevel(permission)).toBe('HIGH')
      })
    })

    it('should classify CRITICAL risk permissions correctly', () => {
      const criticalRiskPermissions = [
        Permission.MANAGE_SECURITY_POLICIES,
        Permission.SYSTEM_ADMIN
      ]

      criticalRiskPermissions.forEach(permission => {
        expect(PermissionUtils.getPermissionRiskLevel(permission)).toBe('CRITICAL')
      })
    })

    it('should default to MEDIUM for unknown permissions', () => {
      // Cast to test unknown permission
      const unknownPermission = 'unknown_permission' as Permission
      expect(PermissionUtils.getPermissionRiskLevel(unknownPermission)).toBe('MEDIUM')
    })
  })

  describe('permission hierarchy logic', () => {
    it('should maintain consistent hierarchy levels', () => {
      // SYSTEM_ADMIN should include all other admin permissions
      const adminPermissions = new Set([Permission.SYSTEM_ADMIN])
      const expanded = PermissionUtils.expandPermissions(adminPermissions)

      expect(expanded.has(Permission.MANAGE_PARTICIPANTS)).toBe(true)
      expect(expanded.has(Permission.MANAGE_SECURITY_POLICIES)).toBe(true)
      expect(expanded.has(Permission.VIEW_AUDIT_LOGS)).toBe(true)
    })

    it('should not create circular dependencies', () => {
      // Test that expanding permissions doesn't create infinite loops
      const allPermissions = Object.values(Permission)
      const allPermissionSet = new Set(allPermissions)
      
      expect(() => {
        PermissionUtils.expandPermissions(allPermissionSet)
      }).not.toThrow()
    })

    it('should preserve permission uniqueness in expansion', () => {
      const permissions = new Set([
        Permission.SYSTEM_ADMIN,
        Permission.MANAGE_PARTICIPANTS,
        Permission.REGISTER_PARTICIPANT
      ])
      
      const expanded = PermissionUtils.expandPermissions(permissions)
      const expandedArray = Array.from(expanded)
      const uniqueExpanded = [...new Set(expandedArray)]
      
      expect(expandedArray.length).toBe(uniqueExpanded.length)
    })
  })

  describe('real-world scenarios', () => {
    it('should handle coordinator role permissions', () => {
      const coordinatorPermissions = new Set([
        Permission.SEND_MESSAGE,
        Permission.READ_MESSAGE,
        Permission.RESPOND_MESSAGE,
        Permission.SEARCH_MESSAGES
      ])
      
      const expanded = PermissionUtils.expandPermissions(coordinatorPermissions)
      
      expect(PermissionUtils.hasPermission(coordinatorPermissions, Permission.SEND_MESSAGE)).toBe(true)
      expect(PermissionUtils.hasPermission(coordinatorPermissions, Permission.READ_OWN_MESSAGES)).toBe(true)
      expect(PermissionUtils.hasPermission(coordinatorPermissions, Permission.MANAGE_PARTICIPANTS)).toBe(false)
    })

    it('should handle maintenance role permissions', () => {
      const maintenancePermissions = new Set([
        Permission.COMPACT_THREADS,
        Permission.ARCHIVE_MESSAGES,
        Permission.VIEW_SYSTEM_STATS
      ])
      
      expect(PermissionUtils.hasPermission(maintenancePermissions, Permission.COMPACT_THREADS)).toBe(true)
      expect(PermissionUtils.hasPermission(maintenancePermissions, Permission.SEND_MESSAGE)).toBe(false)
    })

    it('should handle security officer permissions', () => {
      const securityPermissions = new Set([
        Permission.VIEW_AUDIT_LOGS,
        Permission.MANAGE_SECURITY_POLICIES,
        Permission.VIEW_PARTICIPANT_INFO
      ])
      
      expect(PermissionUtils.hasPermission(securityPermissions, Permission.VIEW_AUDIT_LOGS)).toBe(true)
      expect(PermissionUtils.hasPermission(securityPermissions, Permission.MANAGE_PARTICIPANTS)).toBe(false)
    })
  })
})